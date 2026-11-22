import { NextResponse } from "next/server";
import { fetchMarketQuotes, getDefaultMarketSymbols } from "@/lib/market-data";

export const runtime = "nodejs";

function requestedSymbols(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("symbols");
  if (!requested) return getDefaultMarketSymbols();

  const symbols = [...new Set(requested.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9 .&_-]{1,30}$/.test(symbol)))].slice(0, 30);

  return symbols.length ? symbols : getDefaultMarketSymbols();
}

export async function GET(request: Request) {
  try {
    const data = await fetchMarketQuotes(requestedSymbols(request));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "MARKET_DATA_PROVIDER_ERROR";
    const status = code === "MARKET_DATA_NOT_CONFIGURED" ? 503
      : code === "MARKET_DATA_RATE_LIMITED" ? 429
      : code === "MARKET_DATA_CONFIGURATION_INVALID" ? 500
      : code === "MARKET_DATA_RESPONSE_INVALID" ? 502 : 502;

    if (status >= 500 && code !== "MARKET_DATA_NOT_CONFIGURED") {
      console.error("DNX market-data request failed.", code);
    }

    const message = code === "MARKET_DATA_NOT_CONFIGURED"
      ? "Market-data provider credentials are not configured."
      : code === "MARKET_DATA_RATE_LIMITED"
        ? "The market-data provider rate limit was reached."
        : code === "MARKET_DATA_RESPONSE_INVALID"
          ? "The provider returned data in an unsupported format."
          : "Market quotes are temporarily unavailable.";

    return NextResponse.json({ error: message, code }, {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
