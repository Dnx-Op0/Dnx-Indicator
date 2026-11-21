import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!secret || secret.length < 32 || !token) return false;

  const expected = Buffer.from(secret);
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
