# DNX INDICATES market-data integration

The app exposes a server-side market quotes endpoint at `/api/market/quotes`. Provider credentials remain on the server and are never sent to the browser.

## Provider requirements

Choose an exchange-authorised provider and a subscription that explicitly permits displaying NSE/BSE quotes in your website or app. NSE states that real-time feeds are subscription products and that redistribution is governed by the subscriber agreement. Confirm both exchange permissions and display/redistribution rights before enabling a public feed.

TrueData documents REST and WebSocket market-data APIs for NSE/BSE segments. Its API onboarding process supplies the current technical documentation, sample code and trial credentials after signup. Confirm the exact subscription, symbols, exchange segments, user/display fees and redistribution rights with the provider before using it in production.

## Environment variables

Set these variables in Vercel Project Settings → Environment Variables (and in `.env.local` for local development):

```env
DNX_MARKET_DATA_API_URL=https://your-provider-adapter.example.com/quotes
DNX_MARKET_DATA_API_KEY=your_private_server_side_key
```

Never commit real credentials to Git.

## Provider adapter response contract

The configured endpoint receives a comma-separated `symbols` query parameter and a Bearer token in the `Authorization` header. It must return JSON in this exact normalized shape:

```json
{
  "source": "Licensed Provider Name",
  "mode": "LIVE",
  "asOf": "2026-11-22T10:15:00+05:30",
  "quotes": [
    {
      "symbol": "RELIANCE",
      "name": "Reliance Industries",
      "exchange": "NSE",
      "lastPrice": 1450.25,
      "change": 12.5,
      "changePercent": 0.87,
      "asOf": "2026-11-22T10:15:00+05:30"
    }
  ]
}
```

Use `mode: "DELAYED"` for delayed or snapshot data. Do not label delayed data as live. Prices and changes must be numeric, timestamps must be valid ISO date strings, and exchange must be `NSE` or `BSE`.

The endpoint validates provider responses, avoids caching, keeps the API key server-side and returns a clear unconfigured status when credentials are absent. The dashboard polls every 60 seconds while visible.

## Important

The repository change provides a secure provider integration boundary and dashboard display. It does not scrape exchange websites or invent prices. A provider-specific adapter still needs to be connected using the current API documentation and credentials supplied by the selected licensed provider. Until then, the live quote panel intentionally remains unconfigured.
