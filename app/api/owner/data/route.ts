import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { companies as demoCompanies, type DividendCompany } from "@/data/demo";
import { isOwnerRequest } from "@/lib/owner-auth";

const BLOB_PATHNAME = "dnx-indicates/owner-data.json";

type StorageStatus = {
  mode: "vercel-blob" | "local-file" | "demo-read-only";
  persistent: boolean;
  editable: boolean;
};

function ownerDataPath() {
  return resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DNX_OWNER_DATA_FILE ?? "data/owner-data.json");
}

function storageStatus(): StorageStatus {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { mode: "vercel-blob", persistent: true, editable: true };
  }
  if (process.env.NODE_ENV === "production") {
    return { mode: "demo-read-only", persistent: false, editable: false };
  }
  return { mode: "local-file", persistent: true, editable: true };
}

function validCompany(value: unknown): value is DividendCompany {
  if (!value || typeof value !== "object") return false;
  const company = value as Record<string, unknown>;
  const stringFields = ["name", "symbol", "sector", "announcement", "exDate", "recordDate", "paymentDate"];
  if (!stringFields.every((field) => typeof company[field] === "string")) return false;
  if (!(company.name as string).trim() || !(company.symbol as string).trim() || !(company.sector as string).trim()) return false;
  if (!["Interim", "Final", "Special", "Dividend"].includes(String(company.type))) return false;
  const numberFields = ["marketCap", "yield", "dividend", "payout"];
  if (!numberFields.every((field) => company[field] === null
    || (typeof company[field] === "number" && Number.isFinite(company[field]) && (company[field] as number) >= 0))) return false;
  if (company.manualUpdateAt !== undefined
    && (typeof company.manualUpdateAt !== "string" || Number.isNaN(Date.parse(company.manualUpdateAt)))) return false;
  if (company.manualSourceUrl !== undefined && typeof company.manualSourceUrl !== "string") return false;
  if (company.sourceExchange !== undefined && company.sourceExchange !== "NSE" && company.sourceExchange !== "BSE") return false;
  if (company.exchangeSymbol !== undefined && typeof company.exchangeSymbol !== "string") return false;
  if (company.sourceUpdatedAt !== undefined
    && (typeof company.sourceUpdatedAt !== "string" || Number.isNaN(Date.parse(company.sourceUpdatedAt)))) return false;
  if (company.sourceUrl !== undefined && typeof company.sourceUrl !== "string") return false;
  if (company.sourceDescription !== undefined && typeof company.sourceDescription !== "string") return false;
  if (company.yieldAsOf !== undefined
    && (typeof company.yieldAsOf !== "string" || Number.isNaN(Date.parse(company.yieldAsOf)))) return false;
  if (company.yieldPeriodStart !== undefined
    && (typeof company.yieldPeriodStart !== "string" || Number.isNaN(Date.parse(company.yieldPeriodStart)))) return false;
  if (company.yieldPriceExchange !== undefined
    && company.yieldPriceExchange !== "NSE" && company.yieldPriceExchange !== "BSE") return false;
  if ((company.yieldAsOf !== undefined) !== (company.yieldPriceExchange !== undefined)
    || (company.yieldPeriodStart !== undefined && !company.yieldAsOf)
    || (company.yieldAsOf !== undefined && company.yield === null)) return false;
  if (company.sourceExchange && (!(company.exchangeSymbol as string)?.trim() || !company.sourceUpdatedAt || !company.sourceUrl)) return false;
  if (!company.sourceExchange && !company.manualUpdateAt && ["marketCap", "yield", "dividend", "payout"].some((field) => company[field] === null)) return false;
  if (typeof company.manualSourceUrl === "string" && company.manualSourceUrl.trim()) {
    try {
      const sourceUrl = new URL(company.manualSourceUrl);
      if (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") return false;
    } catch {
      return false;
    }
  }
  if (typeof company.sourceUrl === "string" && company.sourceUrl.trim()) {
    try {
      const sourceUrl = new URL(company.sourceUrl);
      if (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") return false;
    } catch {
      return false;
    }
  }
  return ["announcement", "exDate", "recordDate", "paymentDate"].every((field) => {
    const date = (company[field] as string).trim();
    return date ? !Number.isNaN(Date.parse(date)) : Boolean(company.sourceExchange || (company.manualUpdateAt && field !== "exDate"));
  }) && Boolean((company.exDate as string).trim());
}

function validCompanyList(value: unknown): value is DividendCompany[] {
  if (!Array.isArray(value) || value.length > 5000 || !value.every(validCompany)) return false;
  const symbols = value.map((company) => company.symbol.trim().toUpperCase());
  return new Set(symbols).size === symbols.length;
}

async function loadCompanies() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await get(BLOB_PATHNAME, { access: "private", useCache: false });
    if (!blob) return demoCompanies;
    if (blob.statusCode !== 200) throw new Error("Could not read the saved company dataset from private storage.");
    const stored: unknown = JSON.parse(await new Response(blob.stream).text());
    if (!validCompanyList(stored)) throw new Error("Private company data contains invalid company records.");
    return stored;
  }

  if (process.env.NODE_ENV === "production") return demoCompanies;

  try {
    const contents = await readFile(ownerDataPath(), "utf8");
    const stored: unknown = JSON.parse(contents);
    if (!validCompanyList(stored)) throw new Error("Owner data file contains invalid company records.");
    return stored;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return demoCompanies;
    throw error;
  }
}

export async function GET() {
  try {
    return NextResponse.json({ companies: await loadCompanies(), storage: storageStatus() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not read DNX owner data.", error);
    return NextResponse.json({ error: "Could not load company data." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isOwnerRequest(request)) {
    return NextResponse.json({ error: "Owner access is required to update company data." }, { status: 401 });
  }

  let body: { companies?: unknown };
  try {
    body = await request.json() as { companies?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!validCompanyList(body.companies)) {
    return NextResponse.json({ error: "Company data is invalid. Check required fields, available metrics, dates, and duplicate symbols." }, { status: 400 });
  }

  const storage = storageStatus();
  if (!storage.editable) {
    return NextResponse.json({
      error: "Persistent company storage is not configured. Connect the private Vercel Blob store before publishing edits.",
    }, { status: 503 });
  }

  if (storage.mode === "vercel-blob") {
    try {
      await put(BLOB_PATHNAME, `${JSON.stringify(body.companies, null, 2)}\n`, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
      });
      return NextResponse.json({ companies: body.companies, storage }, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("Could not save DNX owner data to private Blob storage.", error);
      return NextResponse.json({ error: "Could not save company data to persistent storage." }, { status: 500 });
    }
  }

  const path = ownerDataPath();
  const temporaryPath = `${path}.${Date.now()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(body.companies, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
    return NextResponse.json({ companies: body.companies, storage }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not save DNX owner data.", error);
    return NextResponse.json({ error: "Could not save company data to the configured data file." }, { status: 500 });
  }
}
