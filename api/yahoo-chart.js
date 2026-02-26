// ─── Vercel serverless proxy for Yahoo Finance chart API ─────────────────────
// Bypasses CORS restrictions so the client-side app can fetch historical
// candle data from Yahoo Finance for free.
//
// Usage:  /api/yahoo-chart?ticker=AAPL&from=1706140800&to=1737763200
//   - ticker: stock symbol (required)
//   - from:   Unix timestamp start (required)
//   - to:     Unix timestamp end (required)

export default async function handler(req, res) {
  const { ticker, from, to } = req.query;

  if (!ticker || !from || !to) {
    return res.status(400).json({ error: 'Missing required params: ticker, from, to' });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${from}&period2=${to}&interval=1d&includeAdjustedClose=true`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AJAWealth/1.0)',
      },
    });

    const data = await resp.json();

    // Cache for 5 minutes on Vercel CDN, serve stale for 1 minute while revalidating
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(resp.ok ? 200 : resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
