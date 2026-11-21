import { NextResponse } from "next/server";
import {
  clearOwnerCookie,
  isOwnerRequest,
  issueOwnerCookie,
  ownerLoginConfigured,
  ownerLoginConfigurationIssue,
  verifyOwnerCredentials,
} from "@/lib/owner-auth";

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isOwnerRequest(request) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!ownerLoginConfigured()) {
    return NextResponse.json(
      { error: ownerLoginConfigurationIssue() },
      { status: 503 },
    );
  }

  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = await request.json() as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Enter a valid email address and password." }, { status: 400 });
  }

  if (typeof credentials.email !== "string" || typeof credentials.password !== "string"
    || credentials.email.length > 254 || credentials.password.length > 1024) {
    return NextResponse.json({ error: "Enter a valid email address and password." }, { status: 400 });
  }
  if (!verifyOwnerCredentials(credentials.email, credentials.password)) {
    return NextResponse.json({ error: "The owner email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  issueOwnerCookie(response);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearOwnerCookie(response);
  return response;
}
