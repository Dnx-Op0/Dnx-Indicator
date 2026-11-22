import { isOwnerRequest } from "@/lib/owner-auth";
import { getDividendSyncStatus, getNextScheduledSync } from "@/lib/dividend-sync";

export async function GET(request: Request) {
  if (!isOwnerRequest(request)) {
    return Response.json({ error: "Developer authentication required." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({
      databaseConfigured: false,
      sourceConfigured: Boolean(process.env.DNX_DIVIDEND_FEED_URL),
      nextScheduledAt: getNextScheduledSync().toISOString(),
      monitoredCompanies: null,
      lastSuccessfulAt: null,
      recentRuns: [],
      notifications: [],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const status = await getDividendSyncStatus();
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not read dividend synchronization status.", error);
    return Response.json({ error: "Could not read the PostgreSQL synchronization status." }, { status: 503 });
  }
}
