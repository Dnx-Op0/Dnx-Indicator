import type { DividendCompany } from "@/data/demo";

export type Exchange = "NSE" | "BSE";

export type OfficialDividendImport = {
  companies: DividendCompany[];
  skippedRows: number;
  duplicateRows: number;
};

const sourceUrls: Record<Exchange, string> = {
  NSE: "https://www.nseindia.com/companies-listing/corporate-filings-actions",
  BSE: "https://www.bseindia.com/corporates/corporates_act?expandable=0",
};

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function normalizedHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dateValue(value: string | undefined) {
  const input = value?.trim() ?? "";
  if (!input || input === "-") return "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (slashDate) return `${slashDate[3]}-${slashDate[2].padStart(2, "0")}-${slashDate[1].padStart(2, "0")}`;

  const namedDate = /^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s-]+(\d{4})$/.exec(input);
  if (!namedDate) return "";
  const month = new Map([
    ["jan", "01"], ["feb", "02"], ["mar", "03"], ["apr", "04"],
    ["may", "05"], ["jun", "06"], ["jul", "07"], ["aug", "08"],
    ["sep", "09"], ["oct", "10"], ["nov", "11"], ["dec", "12"],
  ]).get(namedDate[2].slice(0, 3).toLowerCase());
  if (!month) return "";
  return `${namedDate[3]}-${month}-${namedDate[1].padStart(2, "0")}`;
}

function displayDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function amountValue(purpose: string) {
  const match = /(?:₹|R(?:s|e)?\.?)\s*-?\s*([\d,]+(?:\.\d+)?)/i.exec(purpose);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function dividendType(purpose: string): DividendCompany["type"] {
  if (/special/i.test(purpose)) return "Special";
  if (/interim/i.test(purpose)) return "Interim";
  if (/final/i.test(purpose)) return "Final";
  return "Dividend";
}

function fieldIndex(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizedHeader);
  for (const alias of aliases) {
    const index = normalizedHeaders.indexOf(normalizedHeader(alias));
    if (index >= 0) return index;
  }
  return -1;
}

function indiaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isWithinImportWindow(date: string, asOf: Date) {
  if (!date) return false;
  const end = indiaDateKey(asOf);
  const [year, month, day] = end.split("-").map(Number);
  const startYear = year - 1;
  const startDay = Math.min(day, new Date(Date.UTC(startYear, month, 0)).getUTCDate());
  const endYear = year + 1;
  const endDay = Math.min(day, new Date(Date.UTC(endYear, month, 0)).getUTCDate());
  const startKey = `${startYear}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
  const endKey = `${endYear}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return date >= startKey && date <= endKey;
}

export function parseOfficialDividendCsv(
  content: string,
  exchange: Exchange,
  asOf = new Date(),
): OfficialDividendImport {
  const rows = parseCsv(content.trim());
  if (rows.length < 2) throw new Error("The CSV is empty or does not contain any data rows.");

  const headers = rows[0];
  const symbolIndex = fieldIndex(headers, exchange === "NSE"
    ? ["Symbol", "NSE Symbol"]
    : ["Security Code"]);
  const displaySymbolIndex = exchange === "BSE" ? fieldIndex(headers, ["Security Name"]) : symbolIndex;
  const nameIndex = fieldIndex(headers, ["Company Name", "Security Name", "Company"]);
  const purposeIndex = fieldIndex(headers, ["Purpose", "Corporate Action"]);
  const exDateIndex = fieldIndex(headers, ["Ex Date", "Ex-Date", "ExDate"]);
  const recordDateIndex = fieldIndex(headers, ["Record Date", "RecordDate"]);
  const paymentDateIndex = fieldIndex(headers, ["Actual Payment Date", "Payment Date", "PaymentDate"]);
  const seriesIndex = fieldIndex(headers, ["Series"]);

  if ([symbolIndex, nameIndex, purposeIndex, exDateIndex].some((index) => index < 0)) {
    throw new Error(`This CSV does not match the official ${exchange} corporate-actions export format.`);
  }

  const importedAt = asOf.toISOString();
  const latestBySymbol = new Map<string, DividendCompany>();
  let skippedRows = 0;
  let duplicateRows = 0;

  for (const row of rows.slice(1)) {
    const value = (index: number) => index < 0 ? "" : row[index]?.trim() ?? "";
    const rawSymbol = value(symbolIndex);
    const name = value(nameIndex);
    const purpose = value(purposeIndex);
    const series = value(seriesIndex);
    const exDate = dateValue(value(exDateIndex));

    if (!rawSymbol || !name || !/dividend/i.test(purpose) || /distribution|per\s+unit/i.test(purpose)
      || (series && series.toUpperCase() !== "EQ") || !isWithinImportWindow(exDate, asOf)) {
      skippedRows += 1;
      continue;
    }

    const exchangeSymbol = value(displaySymbolIndex) || rawSymbol;
    const symbol = exchange === "NSE" ? `NSE:${rawSymbol}` : `BSE:${rawSymbol}`;
    const company: DividendCompany = {
      name,
      symbol,
      exchangeSymbol,
      sourceExchange: exchange,
      sourceUpdatedAt: importedAt,
      sourceUrl: sourceUrls[exchange],
      sourceDescription: purpose,
      sector: "Not provided by exchange export",
      marketCap: null,
      yield: null,
      dividend: amountValue(purpose),
      type: dividendType(purpose),
      announcement: "",
      exDate: displayDate(exDate),
      recordDate: displayDate(dateValue(value(recordDateIndex))),
      paymentDate: displayDate(dateValue(value(paymentDateIndex))),
      payout: null,
    };

    const previous = latestBySymbol.get(symbol);
    if (previous) duplicateRows += 1;
    if (!previous) {
      latestBySymbol.set(symbol, company);
    } else {
      const previousDate = dateValue(previous.exDate);
      const today = indiaDateKey(asOf);
      const previousIsUpcoming = previousDate >= today;
      const currentIsUpcoming = exDate >= today;
      // Prefer the nearest upcoming event; if none exists, retain the most recent past event.
      if ((currentIsUpcoming && !previousIsUpcoming)
        || (currentIsUpcoming && previousIsUpcoming && exDate < previousDate)
        || (!currentIsUpcoming && !previousIsUpcoming && exDate > previousDate)) {
        latestBySymbol.set(symbol, company);
      }
    }
  }

  if (!latestBySymbol.size) {
    throw new Error(`No dividend records within the import window (12 months past to 12 months future) were found in this ${exchange} export.`);
  }

  return { companies: [...latestBySymbol.values()], skippedRows, duplicateRows };
}
