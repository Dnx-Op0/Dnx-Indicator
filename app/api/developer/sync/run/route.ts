import { isOwnerRequest } from "@/lib/owner-auth";
import { runDividendSync } from "@/lib/dividend-sync";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isOwnerRequest(request)) {
    return Response.json({ error: "Developer authentication required." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "PostgreSQL is not configured; synchronization was not run." }, { status: 503 });
  }

  try {
    const result = await runDividendSync("INCREMENTAL", "MANUAL");
    return Response.json(result, { status: result.status === "SUCCEEDED" ? 200 : 503 });
  } catch (error) {
    console.error("Manual dividend synchronization failed before completion.", error);
    return Response.json({ error: "The synchronization run could not be persisted." }, { status: 503 });
  }
}
