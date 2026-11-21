import { isCronAuthorized } from "@/lib/cron-auth";
import { runDividendSync } from "@/lib/dividend-sync";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized cron request." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "PostgreSQL is not configured; synchronization was not run." }, { status: 503 });
  }

  try {
    const result = await runDividendSync("INCREMENTAL", "CRON");
    return Response.json(result, { status: result.status === "SUCCEEDED" ? 200 : 503 });
  } catch (error) {
    console.error("Incremental dividend cron failed before completion.", error);
    return Response.json({ error: "The synchronization run could not be persisted." }, { status: 503 });
  }
}
