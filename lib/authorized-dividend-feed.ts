import "server-only";

import { getPrisma } from "@/lib/prisma";
import type { DividendSourceAdapter, DividendSourceRecord } from "@/lib/dividend-sync";

type FeedRow = {
  id?: unknown;
  exchange?: unknown;
  symbol?: unknown;
  companyName?: unknown;
  amountPerShare?: unknown;
  percentage?: unknown;
  dividendType?: unknown;
  financialYear?: unknown;
  announcementDate?: unknown;
  publishedAt?: unknown;
  exDate?: unknown;
  recordDate?: unknown;
  paymentDate?: unknown;
  status?: unknown;
  announcementUrl?: unknown;
};

function dateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid date in dividend feed.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date in dividend feed.");
  return date;
}

function requiredDate(value: unknown, fallback: unknown): Date {
  const date = dateOrNull(value) ?? dateOrNull(fallback);
  if (!date) throw new Error("Dividend feed rows must include announcementDate or publishedAt.");
  return date;
}

function decimal(value: unknown, field: string, optional = false): string | null {
  if ((value === null || value === undefined || value === "") && optional) return null;
  if (typeof value !== "number" && typeof value !== "string") throw new Error(`Invalid ${field} in dividend feed.`);
  const text = String(value).replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new Error(`Invalid ${field} in dividend feed.`);
  return text;
}

function normalizedSymbol(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Dividend feed row has no symbol.");
  return value.trim().toUpperCase().replace(/^(NSE:|BSE:)/, "");
}

function verificationStatus(value: unknown): DividendSourceRecord["verificationStatus"] {
  const status = typeof value === "string" ? value.toUpperCase() : "ANNOUNCED";
  if (status.includes("CANCEL")) return "CANCELLED";
  if (status.includes("REVIS")) return "REVISED";
  if (status.includes("CONFIRM")) return "CONFIRMED";
  return "ANNOUNCED";
}

/**
 * Connect this adapter only to a licensed or otherwise authorized provider endpoint.
 * Expected response: { "records": [{ id, exchange, symbol, amountPerShare, dividendType,
 * announcementDate, publishedAt?, exDate?, recordDate?, paymentDate?, status?,
 * financialYear?, percentage?, announcementUrl? }] }.
 */
export function getAuthorizedDividendFeedAdapter(): DividendSourceAdapter | null {
  const endpoint = process.env.DNX_DIVIDEND_FEED_URL;
  if (!endpoint) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("DNX_DIVIDEND_FEED_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("The dividend feed endpoint must use HTTPS in production.");
  }

  return {
    async sync(mode) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      let response: Response;
      try {
        const requestUrl = new URL(url);
        requestUrl.searchParams.set("mode", mode.toLowerCase());
        response = await fetch(requestUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(process.env.DNX_DIVIDEND_FEED_TOKEN
              ? { Authorization: `Bearer ${process.env.DNX_DIVIDEND_FEED_TOKEN}` }
              : {}),
          },
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        throw new Error("The configured dividend feed could not be reached.");
      } finally {
        clearTimeout(timeout);
      }
      if (response.status === 429 || response.status >= 500) {
        throw new Error("The configured dividend provider is temporarily unavailable.");
      }
      if (!response.ok) throw new Error(`Dividend feed returned HTTP ${response.status}.`);
      const body = await response.text();
      if (body.length > 5_000_000) throw new Error("Dividend feed response exceeded the 5 MB safety limit.");

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new Error("Dividend feed did not return valid JSON.");
      }
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { records?: unknown }).records)) {
        throw new Error('Dividend feed response must contain a "records" array.');
      }

      const prisma = getPrisma();
      const companyByKey = new Map<string, string>();
      const existingCompanies = await prisma.company.findMany({
        select: { id: true, nseSymbol: true, bseCode: true },
      });
      for (const company of existingCompanies) {
        if (company.nseSymbol) companyByKey.set(`NSE:${company.nseSymbol.toUpperCase()}`, company.id);
        if (company.bseCode) companyByKey.set(`BSE:${company.bseCode.toUpperCase()}`, company.id);
      }

      const source = process.env.DNX_DIVIDEND_FEED_NAME?.trim() || "AUTHORIZED_PROVIDER";
      const records: DividendSourceRecord[] = [];
      const seen = new Set<string>();
      for (const raw of (payload as { records: FeedRow[] }).records) {
        if (!raw || typeof raw !== "object") continue;
        const exchange = raw.exchange === "BSE" ? "BSE" : raw.exchange === "NSE" ? "NSE" : null;
        if (!exchange) continue;
        const symbol = normalizedSymbol(raw.symbol);
        const key = `${exchange}:${symbol}`;
        let companyId = companyByKey.get(key);
        if (!companyId) {
          const name = typeof raw.companyName === "string" && raw.companyName.trim()
            ? raw.companyName.trim()
            : symbol;
          const created = exchange === "NSE"
            ? await prisma.company.upsert({
                where: { nseSymbol: symbol },
                create: { name, nseSymbol: symbol },
                update: { name },
                select: { id: true },
              })
            : await prisma.company.upsert({
                where: { bseCode: symbol },
                create: { name, bseCode: symbol },
                update: { name },
                select: { id: true },
              });
          companyId = created.id;
          companyByKey.set(key, companyId);
        }

        const amount = decimal(raw.amountPerShare, "amountPerShare");
        const externalId = typeof raw.id === "string" || typeof raw.id === "number"
          ? String(raw.id).trim()
          : `${exchange}-${symbol}-${String(raw.announcementDate ?? raw.publishedAt ?? "")}-${amount}`;
        if (!externalId) continue;
        const sourceRecordKey = `${source}:${exchange}:${externalId}`;
        if (seen.has(sourceRecordKey)) continue;
        seen.add(sourceRecordKey);

        const announcementDate = requiredDate(raw.announcementDate, raw.publishedAt);
        const type = typeof raw.dividendType === "string" && raw.dividendType.trim()
          ? raw.dividendType.trim()
          : "Dividend";
        const announcementUrl = typeof raw.announcementUrl === "string" && /^https:\/\//i.test(raw.announcementUrl)
          ? raw.announcementUrl
          : null;

        records.push({
          companyId,
          source,
          sourceReference: externalId,
          sourceRecordKey,
          sourceAnnouncementUrl: announcementUrl,
          amount: amount!,
          percentage: decimal(raw.percentage, "percentage", true),
          type,
          financialYear: typeof raw.financialYear === "string" ? raw.financialYear : null,
          announcementDate,
          sourcePublishedAt: dateOrNull(raw.publishedAt),
          exDate: dateOrNull(raw.exDate),
          recordDate: dateOrNull(raw.recordDate),
          paymentDate: dateOrNull(raw.paymentDate),
          verificationStatus: verificationStatus(raw.status),
        });
      }
      return { companiesChecked: companies.length, records };
    },
  };
}
