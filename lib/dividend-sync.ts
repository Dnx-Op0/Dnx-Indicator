import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAuthorizedDividendFeedAdapter } from "@/lib/authorized-dividend-feed";
import { RetryableSyncError } from "@/lib/retryable-sync-error";

const MAX_ATTEMPTS = 3;

export type DividendSourceRecord = {
  companyId: string;
  source: string;
  sourceReference: string;
  sourceRecordKey: string;
  sourceAnnouncementUrl: string | null;
  amount: string;
  percentage: string | null;
  type: string;
  financialYear: string | null;
  announcementDate: Date;
  sourcePublishedAt: Date | null;
  exDate: Date | null;
  recordDate: Date | null;
  paymentDate: Date | null;
  verificationStatus: "ANNOUNCED" | "CONFIRMED" | "REVISED" | "CANCELLED" | "UNVERIFIED";
};

export type DividendSourceAdapter = {
  sync: (mode: "INCREMENTAL" | "FULL") => Promise<{
    companiesChecked: number;
    records: DividendSourceRecord[];
  }>;
};

function getAuthorizedSourceAdapter(): DividendSourceAdapter | null {
  return getAuthorizedDividendFeedAdapter();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retrySourceRequest<T>(request: () => Promise<T>, onAttempt: (attempt: number) => void) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    onAttempt(attempt);
    try {
      return { result: await request(), attempts: attempt };
    } catch (error) {
      if (!(error instanceof RetryableSyncError) || attempt === MAX_ATTEMPTS) throw error;
      await delay(1_000 * 2 ** (attempt - 1));
    }
  }
  throw new Error("Dividend source retry loop ended unexpectedly.");
}

function toSnapshot(record: DividendSourceRecord) {
  return {
    source: record.source,
    sourceReference: record.sourceReference,
    sourceAnnouncementUrl: record.sourceAnnouncementUrl,
    amount: canonicalDecimal(record.amount),
    percentage: record.percentage === null ? null : canonicalDecimal(record.percentage),
    type: record.type,
    financialYear: record.financialYear,
    announcementDate: record.announcementDate.toISOString(),
    sourcePublishedAt: record.sourcePublishedAt?.toISOString() ?? null,
    exDate: record.exDate?.toISOString() ?? null,
    recordDate: record.recordDate?.toISOString() ?? null,
    paymentDate: record.paymentDate?.toISOString() ?? null,
    verificationStatus: record.verificationStatus,
  };
}

function canonicalDecimal(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

function isValidDecimal(value: string, maxWholeDigits: number, maxFractionDigits: number) {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return whole.length <= maxWholeDigits && fraction.length <= maxFractionDigits;
}

function changedDate(existing: Date | null, incoming: Date | null) {
  return existing?.toISOString() !== incoming?.toISOString();
}

async function saveSourceRecords(records: DividendSourceRecord[]) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    let created = 0;
    let updated = 0;

    for (const record of records) {
      if (!isValidDecimal(record.amount, 10, 4)
        || (record.percentage !== null && !isValidDecimal(record.percentage, 6, 4))
        || !record.source.trim() || !record.sourceReference.trim()
        || !record.sourceRecordKey.trim() || !record.type.trim()
        || Number.isNaN(record.announcementDate.getTime())
        || (record.sourcePublishedAt !== null && Number.isNaN(record.sourcePublishedAt.getTime()))
        || (record.exDate !== null && Number.isNaN(record.exDate.getTime()))
        || (record.recordDate !== null && Number.isNaN(record.recordDate.getTime()))
        || (record.paymentDate !== null && Number.isNaN(record.paymentDate.getTime()))) {
        throw new Error("The dividend source returned an invalid record.");
      }

      const company = await transaction.company.findUnique({
        where: { id: record.companyId },
        select: { name: true },
      });
      if (!company) throw new Error("The dividend source referenced an unknown company.");

      const current = await transaction.dividend.findUnique({
        where: { sourceRecordKey: record.sourceRecordKey },
      });

      if (!current) {
        await transaction.dividend.create({
          data: {
            ...record,
            sourceRetrievedAt: new Date(),
          },
        });
        await transaction.developerNotification.create({
          data: {
            type: record.verificationStatus === "CANCELLED" ? "DIVIDEND_CANCELLED" : "NEW_DIVIDEND",
            title: record.verificationStatus === "CANCELLED" ? "Dividend cancelled" : "New dividend detected",
            message: `${record.source} reported a dividend update for ${company.name}.`,
          },
        });
        created += 1;
        continue;
      }

      const dateWasChanged = changedDate(current.exDate, record.exDate)
        || changedDate(current.recordDate, record.recordDate)
        || changedDate(current.paymentDate, record.paymentDate);
      const previousSnapshot = {
        source: current.source,
        sourceReference: current.sourceReference,
        sourceAnnouncementUrl: current.sourceAnnouncementUrl,
        amount: canonicalDecimal(current.amount.toString()),
        percentage: current.percentage ? canonicalDecimal(current.percentage.toString()) : null,
        type: current.type,
        financialYear: current.financialYear,
        announcementDate: current.announcementDate.toISOString(),
        sourcePublishedAt: current.sourcePublishedAt?.toISOString() ?? null,
        exDate: current.exDate?.toISOString() ?? null,
        recordDate: current.recordDate?.toISOString() ?? null,
        paymentDate: current.paymentDate?.toISOString() ?? null,
        verificationStatus: current.verificationStatus,
      };
      const incomingSnapshot = toSnapshot(record);
      if (JSON.stringify(previousSnapshot) === JSON.stringify(incomingSnapshot)) {
        await transaction.dividend.update({
          where: { id: current.id },
          data: { sourceRetrievedAt: new Date() },
        });
        continue;
      }

      await transaction.dividendRevision.create({
        data: {
          dividendId: current.id,
          snapshot: previousSnapshot as Prisma.InputJsonValue,
        },
      });
      await transaction.dividend.update({
        where: { id: current.id },
        data: {
          ...record,
          sourceRetrievedAt: new Date(),
        },
      });
      await transaction.developerNotification.create({
        data: {
          type: record.verificationStatus === "CANCELLED" ? "DIVIDEND_CANCELLED" : "DATE_CHANGE",
          title: record.verificationStatus === "CANCELLED" ? "Dividend cancelled" : "Dividend record revised",
          message: `${record.source} reported a change for ${company.name}.`,
        },
      });
      updated += 1;
      if (dateWasChanged) {
        await transaction.developerNotification.create({
          data: {
            type: "DATE_CHANGE",
            title: "Dividend dates changed",
            message: `Ex-date, record date, or payment date changed for ${company.name}.`,
          },
        });
      }
    }

    return { created, updated };
  });
}

export async function runDividendSync(mode: "INCREMENTAL" | "FULL", trigger: "CRON" | "MANUAL") {
  const prisma = getPrisma();
  const run = await prisma.syncRun.create({
    data: { mode, trigger, status: "RUNNING" },
  });
  const adapter = getAuthorizedSourceAdapter();

  if (!adapter) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "UNCONFIGURED", finishedAt: new Date(), errorCode: "SOURCE_NOT_CONFIGURED" },
    });
    await prisma.developerNotification.upsert({
      where: { dedupeKey: "dividend-source-unconfigured" },
      create: {
        dedupeKey: "dividend-source-unconfigured",
        type: "SYNC_FAILED",
        title: "Dividend synchronization is not configured",
        message: "No approved, documented dividend data source is connected. No financial data was fetched or published.",
      },
      update: { createdAt: new Date(), readAt: null },
    });
    return { status: "UNCONFIGURED" as const, runId: run.id };
  }

  let attempts = 0;
  try {
    const { result, attempts: completedAttempts } = await retrySourceRequest(() => adapter.sync(mode), (attempt) => {
      attempts = attempt;
    });
    const counts = await saveSourceRecords(result.records);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        attempts: completedAttempts,
        companiesChecked: result.companiesChecked,
        detected: result.records.length,
        created: counts.created,
        updated: counts.updated,
        errorCode: null,
      },
    });
    await prisma.developerNotification.updateMany({
      where: { dedupeKey: { in: ["dividend-source-unconfigured", "dividend-sync-failed"] }, readAt: null },
      data: { readAt: new Date() },
    });
    return { status: "SUCCEEDED" as const, runId: run.id, ...counts };
  } catch (error) {
    const errorCode = error instanceof RetryableSyncError ? "SOURCE_UNAVAILABLE" : "SYNC_FAILED";
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), attempts, errorCode },
    });
    await prisma.developerNotification.upsert({
      where: { dedupeKey: "dividend-sync-failed" },
      create: {
        dedupeKey: "dividend-sync-failed",
        type: "SYNC_FAILED",
        title: "Dividend synchronization failed",
        message: error instanceof RetryableSyncError
          ? "The authorized data source remained unavailable after retries."
          : "Synchronization failed during validation or database persistence. Review server logs.",
      },
      update: {
        title: "Dividend synchronization failed",
        message: error instanceof RetryableSyncError
          ? "The authorized data source remained unavailable after retries."
          : "Synchronization failed during validation or database persistence. Review server logs.",
        createdAt: new Date(),
        readAt: null,
      },
    });
    console.error("Dividend synchronization failed.", error);
    return { status: "FAILED" as const, runId: run.id, errorCode };
  }
}

function scheduledAt(date: Date) {
  return date.getUTCHours() === 10 && date.getUTCMinutes() === 30;
}

export function getNextScheduledSync(now = new Date()) {
  const firstMinute = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
  for (let offset = 0; offset < 8 * 24 * 60; offset += 1) {
    const candidate = new Date(firstMinute + offset * 60_000);
    if (scheduledAt(candidate)) return candidate;
  }
  throw new Error("Could not calculate the next configured synchronization time.");
}

export async function getDividendSyncStatus() {
  const prisma = getPrisma();
  const [lastSuccess, recentRuns, unreadNotifications, monitoredCompanies] = await prisma.$transaction([
    prisma.syncRun.findFirst({
      where: { status: "SUCCEEDED" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        mode: true,
        status: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        attempts: true,
        detected: true,
        created: true,
        updated: true,
        errorCode: true,
      },
    }),
    prisma.developerNotification.findMany({
      where: { readAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, title: true, message: true, createdAt: true },
    }),
    prisma.company.count(),
  ]);

  return {
    databaseConfigured: true,
    sourceConfigured: Boolean(process.env.DNX_DIVIDEND_FEED_URL),
    nextScheduledAt: getNextScheduledSync().toISOString(),
    monitoredCompanies,
    lastSuccessfulAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    recentRuns: recentRuns.map((run) => ({
      ...run,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    notifications: unreadNotifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}
