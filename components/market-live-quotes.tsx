"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, RefreshCw } from "lucide-react";

type Quote = {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  lastPrice: number;
  change: number;
  changePercent: number;
  asOf: string;
};

type QuoteResult = {
  source: string;
  mode: "LIVE" | "DELAYED";
  asOf: string;
  quotes: Quote[];
};

const money = (value: number) => `₹${value.toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date) + " IST";
}

export default function MarketLiveQuotes() {
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/market/quotes", { cache: "no-store" });
      const payload = await response.json() as QuoteResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Market quotes are unavailable.");
      setResult(payload);
      setError("");
      setLastChecked(new Date().toISOString());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Market quotes are unavailable.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className="panel dnx-live-quotes" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Live market quotes</h2>
          <p>Provider-sourced prices · refreshes every 60 seconds</p>
        </div>
        <div className="dnx-live-actions">
          {result && <span className={`dnx-feed-badge ${result.mode === "LIVE" ? "is-live" : "is-delayed"}`}>
            <span />{result.mode === "LIVE" ? "LIVE FEED" : "DELAYED FEED"}
          </span>}
          <button className="icon-button" onClick={() => { setLoading(true); void refresh(); }} aria-label="Refresh market quotes" disabled={loading}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="dnx-feed-message" role="status">
          <AlertCircle size={16} />
          <span>{error} Add an authorised provider endpoint and API key to the deployment environment to enable quotes.</span>
        </div>
      )}

      {!error && loading && !result && <div className="dnx-feed-message">Connecting to market-data provider…</div>}

      {result && (
        <>
          <div className="dnx-quote-grid">
            {result.quotes.map((quote) => (
              <article className="dnx-quote-card" key={`${quote.exchange}-${quote.symbol}`}>
                <div className="dnx-quote-heading">
                  <b>{quote.symbol}</b>
                  <span>{quote.exchange}</span>
                </div>
                <div className="dnx-quote-name">{quote.name}</div>
                <strong>{money(quote.lastPrice)}</strong>
                <div className={quote.change >= 0 ? "positive" : "negative"}>
                  {quote.change >= 0 ? "+" : ""}{money(quote.change)} ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                </div>
                <small>As of {timeLabel(quote.asOf)}</small>
              </article>
            ))}
          </div>
          <div className="dnx-feed-footer">
            <span><Activity size={13} /> Source: {result.source}</span>
            <span>Last checked {lastChecked ? timeLabel(lastChecked) : timeLabel(result.asOf)}</span>
          </div>
        </>
      )}
    </section>
  );
}
