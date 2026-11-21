import "server-only";

import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const OWNER_COOKIE_NAME = "dnx_owner_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const SCRYPT_HASH_PATTERN = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{64})$/i;

type AuthConfiguration =
  | { email: string; secret: string; passwordHash: string }
  | { email: string; secret: string; password: string };

function normalizePasswordHash(passwordHash: string) {
  return passwordHash.trim().replace(/\\\$/g, "$");
}

function authConfiguration(): AuthConfiguration | null {
  const developerEmail = process.env.DNX_DEVELOPER_EMAIL;
  const rawDeveloperPasswordHash = process.env.DNX_DEVELOPER_PASSWORD_HASH;
  const developerPasswordHash = rawDeveloperPasswordHash
    ? normalizePasswordHash(rawDeveloperPasswordHash)
    : undefined;
  const developerSecret = process.env.DNX_DEVELOPER_SESSION_SECRET;
  if (developerEmail || developerPasswordHash || developerSecret) {
    if (!developerEmail || !developerPasswordHash || !SCRYPT_HASH_PATTERN.test(developerPasswordHash)
      || !developerSecret || developerSecret.length < 32) return null;
    return { email: developerEmail, passwordHash: developerPasswordHash, secret: developerSecret };
  }

  const email = process.env.DNX_OWNER_EMAIL;
  const password = process.env.DNX_OWNER_PASSWORD;
  const secret = process.env.DNX_SESSION_SECRET;
  if (!email || !password || !secret || secret.length < 32) return null;
  return { email, password, secret };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function ownerLoginConfigured() {
  return authConfiguration() !== null;
}

export function ownerLoginConfigurationIssue() {
  const developerEmail = process.env.DNX_DEVELOPER_EMAIL;
  const developerPasswordHash = process.env.DNX_DEVELOPER_PASSWORD_HASH;
  const developerSecret = process.env.DNX_DEVELOPER_SESSION_SECRET;

  if (developerEmail || developerPasswordHash || developerSecret) {
    const issues: string[] = [];
    if (!developerEmail?.trim()) issues.push("DNX_DEVELOPER_EMAIL is missing.");
    if (!developerPasswordHash
      || !SCRYPT_HASH_PATTERN.test(normalizePasswordHash(developerPasswordHash))) {
      issues.push("DNX_DEVELOPER_PASSWORD_HASH must be a valid scrypt hash.");
    }
    if (!developerSecret || developerSecret.length < 32) {
      issues.push("DNX_DEVELOPER_SESSION_SECRET must be at least 32 characters.");
    }
    return issues.length ? issues.join(" ") : null;
  }

  return authConfiguration() ? null : "Developer credentials are not configured.";
}

function verifyPasswordHash(password: string, passwordHash: string) {
  const match = SCRYPT_HASH_PATTERN.exec(passwordHash);
  if (!match) return false;

  const salt = Buffer.from(match[1], "hex");
  const expectedHash = Buffer.from(match[2], "hex");
  const actualHash = scryptSync(password, salt, expectedHash.length, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actualHash, expectedHash);
}

export function verifyOwnerCredentials(email: string, password: string) {
  const config = authConfiguration();
  if (!config) return false;

  const emailMatches = timingSafeEqual(digest(email.trim().toLowerCase()), digest(config.email.trim().toLowerCase()));
  const passwordMatches = "passwordHash" in config
    ? verifyPasswordHash(password, config.passwordHash)
    : timingSafeEqual(digest(password), digest(config.password));
  return emailMatches && passwordMatches;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueOwnerCookie(response: NextResponse) {
  const config = authConfiguration();
  if (!config) throw new Error("Developer credentials and a session secret must be configured.");

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = Buffer.from(String(expiresAt)).toString("base64url");
  const token = `${payload}.${sign(payload, config.secret)}`;
  response.cookies.set(OWNER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearOwnerCookie(response: NextResponse) {
  response.cookies.set(OWNER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function isOwnerSession(token: string | undefined) {
  const config = authConfiguration();
  if (!config || !token) return false;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  const expectedSignature = sign(payload, config.secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;

  try {
    const expiresAt = Number(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isOwnerRequest(request: Request) {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const token = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${OWNER_COOKIE_NAME}=`))
    ?.slice(OWNER_COOKIE_NAME.length + 1);
  return isOwnerSession(token);
}
