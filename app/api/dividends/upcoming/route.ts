import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function indiaDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function dividendType(value: string): "Interim" | "Final" | "Special" | "Dividend" {
  const normalized = value.toLowerCase();
  if (normalized.includes("interim")) return "Interim";
  if (normalized.includes("final")) return "Final";
  if (normalized.includes("special")) return "Special";
  return "Dividend";
}

/**
 * Public read-only endpoint for approved, automatically synchronized dividend
 * announcements. Manual entries and unverified records are deliberately excluded.
 */
export async function GET() {
  if (!process.env.DATABASE_URL || !process.env.DNX_DIVIDEND_FEED_URL) {
    return NextResponse.json({
      configured: false,
      events: [],
      lastSyncedAt: null,
      message: "Automatic dividend feed is not configured.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const prisma = getPrisma();
    const today = new Date(`${indiaDateKey()}T00:00:00.000Z`);
    const [rows, lastSuccess] = await prisma.$transaction([
      prisma.dividend.findMany({
        where: {
          exDate: { gte: today },
          verificationStatus: { in: ["ANNOUNCED", "CONFIRMED", "REVISED"] },
        },
        include: {
          company: {
            select: {
              name: true,
              nseSymbol: true,
              bseCode: true,
              sector: true,
            },
          },
        },
        orderBy: [{ exDate: "asc" }, { announcementDate: "desc" }],
        take: 1000,
      }),
      prisma.syncRun.findFirst({
        where: { status: "SUCCEEDED" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    ]);

    const events = rows.flatMap((row) => {
      const exchange = row.sourceRecordKey.includes(":BSE:") ? "BSE" : "NSE";
      const symbol = exchange === "BSE"
        ? row.company.bseCode ?? row.company.nseSymbol
        : row.company.nseSymbol ?? row.company.bseCode;
      if (!symbol || !row.exDate) return [];
      return [{
        eventId: row.id,
        name: row.company.name,
        symbol,
        exchange,
        exchangeSymbol: symbol,
        sector: row.company.sector ?? "Other",
        marketCap: null,
        yield: null,
        payout: null,
        dividend: Number(row.amount),
        type: dividendType(row.type),
        announcement: dateOnly(row.announcementDate),
        exDate: dateOnly(row.exDate),
        recordDate: dateOnly(row.recordDate),
        paymentDate: dateOnly(row.paymentDate),
        sourceProvider: row.source,
        sourceUrl: row.sourceAnnouncementUrl,
        sourceUpdatedAt: row.sourceRetrievedAt.toISOString(),
        verificationStatus: row.verificationStatus,
      }];
    });

    return NextResponse.json({
      configured: true,
      events,
      lastSyncedAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load automatically synchronized dividends.", error);
    return NextResponse.json({ error: "Could not load synchronized dividend records." }, { status: 503 });
  }
}
