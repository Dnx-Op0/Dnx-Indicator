export type MarketQuote = {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  lastPrice: number;
  change: number;
  changePercent: number;
  asOf: string;
};

export type MarketQuoteResponse = {
  source: string;
  mode: "LIVE" | "DELAYED";
  asOf: string;
  quotes: MarketQuote[];
};

const DEFAULT_SYMBOLS = ["NIFTY 50", "SENSEX", "RELIANCE", "TCS", "INFY", "HDFCBANK"];

export function getDefaultMarketSymbols() {
  return DEFAULT_SYMBOLS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validQuote(value: unknown): value is MarketQuote {
  if (!isRecord(value)) return false;
  return typeof value.symbol === "string" && value.symbol.trim().length > 0
    && typeof value.name === "string" && value.name.trim().length > 0
    && (value.exchange === "NSE" || value.exchange === "BSE")
    && typeof value.lastPrice === "number" && Number.isFinite(value.lastPrice) && value.lastPrice >= 0
    && typeof value.change === "number" && Number.isFinite(value.change)
    && typeof value.changePercent === "number" && Number.isFinite(value.changePercent)
    && typeof value.asOf === "string" && !Number.isNaN(Date.parse(value.asOf));
}

export function parseMarketQuoteResponse(value: unknown): MarketQuoteResponse | null {
  if (!isRecord(value) || typeof value.source !== "string" || !value.source.trim()
    || (value.mode !== "LIVE" && value.mode !== "DELAYED")
    || typeof value.asOf !== "string" || Number.isNaN(Date.parse(value.asOf))
    || !Array.isArray(value.quotes) || value.quotes.length > 100
    || !value.quotes.every(validQuote)) return null;

  return {
    source: value.source.trim(),
    mode: value.mode,
    asOf: value.asOf,
    quotes: value.quotes,
  };
}

export async function fetchMarketQuotes(symbols: string[]): Promise<MarketQuoteResponse> {
  const endpoint = process.env.DNX_MARKET_DATA_API_URL;
  const apiKey = process.env.DNX_MARKET_DATA_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("MARKET_DATA_NOT_CONFIGURED");
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("MARKET_DATA_CONFIGURATION_INVALID");
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("MARKET_DATA_CONFIGURATION_INVALID");
  }

  url.searchParams.set("symbols", symbols.join(","));
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(response.status === 429 ? "MARKET_DATA_RATE_LIMITED" : "MARKET_DATA_PROVIDER_ERROR");
  }

  const parsed = parseMarketQuoteResponse(await response.json());
  if (!parsed) throw new Error("MARKET_DATA_RESPONSE_INVALID");
  return parsed;
}
