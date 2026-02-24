// ─── Yahoo Finance historical candle client ──────────────────────────────────
// Uses the /api/yahoo-chart serverless proxy (Vercel) or Vite dev proxy
// to fetch free historical daily closing prices from Yahoo Finance.
//
// Returns data in the same format as Finnhub's getCandles():
//   [{ date: 'YYYY-MM-DD', price: number }, ...]

const yahooCache = new Map();
const CACHE_TTL  = 300_000; // 5 min — same as Finnhub candle cache

/**
 * Fetch daily closing prices for a ticker from Yahoo Finance.
 * @param {string} ticker  — e.g. 'AAPL', 'SPY'
 * @param {string} fromDate — 'YYYY-MM-DD'
 * @param {string} toDate   — 'YYYY-MM-DD'
 * @returns {Promise<Array<{date: string, price: number}>>}
 */
export async function getYahooCandles(ticker, fromDate, toDate) {
  const cacheKey = `yf:${ticker}:${fromDate}:${toDate}`;
  const cached = yahooCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const from = Math.floor(new Date(fromDate).getTime() / 1000);
  const to   = Math.floor(new Date(toDate).getTime()   / 1000);

  const res = await fetch(
    `/api/yahoo-chart?ticker=${encodeURIComponent(ticker)}&from=${from}&to=${to}`
  );

  if (!res.ok) {
    throw new Error(`Yahoo chart failed for ${ticker}: ${res.status}`);
  }

  const json = await res.json();
  const result = json.chart?.result?.[0];

  if (!result?.timestamp?.length) {
    // Yahoo returns an error object or empty result for unknown tickers
    const errMsg = json.chart?.error?.description;
    if (errMsg) throw new Error(`Yahoo: ${errMsg}`);
    return [];
  }

  const timestamps = result.timestamp;
  const closes     = result.indicators?.quote?.[0]?.close ?? [];

  const data = timestamps
    .map((ts, i) => ({
      date:  new Date(ts * 1000).toISOString().slice(0, 10),
      price: closes[i],
    }))
    .filter(d => d.price != null); // filter out null entries (e.g. holidays)

  yahooCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}
