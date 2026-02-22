// ─── Finnhub market data client ───────────────────────────────────────────────
// API key is exposed client-side (VITE_ prefix). Acceptable for a personal/demo
// app on the free tier — the key only grants market data read access.

const BASE = 'https://finnhub.io/api/v1';
const KEY  = import.meta.env.VITE_FINNHUB_API_KEY;

export const isConfigured = () => Boolean(KEY);

// ── In-memory caches ─────────────────────────────────────────────────────────
const quoteCache  = new Map(); // ticker  → { data, ts }
const candleCache = new Map(); // cacheKey → { data, ts }
const QUOTE_TTL   = 30_000;   // 30 s  — refresh quotes every 30 s
const CANDLE_TTL  = 300_000;  // 5 min — candles don't change intraday

// ── Quote (current price + daily change) ─────────────────────────────────────
// Returns: { price, change, changePercent, prevClose, high, low, open }
export async function getQuote(ticker) {
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  const res = await fetch(`${BASE}/quote?symbol=${ticker}&token=${KEY}`);
  if (!res.ok) throw new Error(`Quote fetch failed for ${ticker}: ${res.status}`);

  const raw  = await res.json();
  const data = {
    price:         raw.c,
    change:        raw.d,
    changePercent: raw.dp,
    prevClose:     raw.pc,
    high:          raw.h,
    low:           raw.l,
    open:          raw.o,
  };

  quoteCache.set(ticker, { data, ts: Date.now() });
  return data;
}

// ── Historical daily candles ──────────────────────────────────────────────────
// Returns: [{ date: 'YYYY-MM-DD', price: number }, ...]  (closing prices)
export async function getCandles(ticker, fromDate, toDate) {
  const cacheKey = `${ticker}:${fromDate}:${toDate}`;
  const cached   = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CANDLE_TTL) return cached.data;

  const from = Math.floor(new Date(fromDate).getTime() / 1000);
  const to   = Math.floor(new Date(toDate).getTime()   / 1000);

  const res = await fetch(
    `${BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${KEY}`
  );
  if (!res.ok) throw new Error(`Candle fetch failed for ${ticker}: ${res.status}`);

  const raw = await res.json();
  if (raw.s !== 'ok' || !raw.c?.length) return [];

  const data = raw.t.map((ts, i) => ({
    date:  new Date(ts * 1000).toISOString().slice(0, 10),
    price: raw.c[i],
  }));

  candleCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// ── Portfolio chart data (same shape as mockData.getPortfolioChartData) ───────
// Returns: [{ date, portfolio, benchmark? }, ...] — all normalized to 100
const RANGE_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'Max': 1095 };

export async function getRealPortfolioChartData(holdings, benchmarkTicker, range = '1Y') {
  if (!holdings.length) return [];

  const days     = RANGE_DAYS[range] ?? 365;
  const toDate   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  // Fetch all in parallel; catch individual failures so one bad ticker doesn't kill everything
  const [holdingCandles, benchCandles] = await Promise.all([
    Promise.all(holdings.map(h => getCandles(h.ticker, fromDate, toDate).catch(() => []))),
    benchmarkTicker
      ? getCandles(benchmarkTicker, fromDate, toDate).catch(() => [])
      : Promise.resolve([]),
  ]);

  const dates = holdingCandles[0]?.map(d => d.date) ?? [];
  if (!dates.length) return [];

  // Build fast lookup maps
  const priceMaps = holdingCandles.map(candles => {
    const m = {};
    candles.forEach(d => { m[d.date] = d.price; });
    return m;
  });
  const benchMap = {};
  benchCandles.forEach(d => { benchMap[d.date] = d.price; });

  const startPrices    = holdingCandles.map(c => c[0]?.price ?? 1);
  const startBenchmark = benchCandles[0]?.price ?? 1;

  return dates.map(date => {
    // Weighted portfolio value, normalized to 100 at start
    let portfolio = 0;
    holdings.forEach((h, i) => {
      const start   = startPrices[i] || 1;
      const current = priceMaps[i][date] ?? start;
      portfolio += (current / start) * 100 * (h.weight_percent / 100);
    });

    const point = { date, portfolio: parseFloat(portfolio.toFixed(2)) };

    if (benchmarkTicker && startBenchmark > 0) {
      const bPrice = benchMap[date] ?? startBenchmark;
      point.benchmark = parseFloat(((bPrice / startBenchmark) * 100).toFixed(2));
    }

    return point;
  });
}

// ── WebSocket — real-time trade feed ─────────────────────────────────────────
let ws            = null;
const wsSubscribed  = new Set();
const tradeListeners = new Set();

function ensureWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(`wss://ws.finnhub.io?token=${KEY}`);

  ws.onopen = () => {
    wsSubscribed.forEach(ticker => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
    });
  };

  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'trade' && msg.data) {
        msg.data.forEach(trade => {
          tradeListeners.forEach(cb => cb(trade.s, trade.p));
        });
      }
    } catch { /* ignore malformed messages */ }
  };

  ws.onclose = () => {
    // Auto-reconnect after 5 s if we have active subscriptions
    if (wsSubscribed.size > 0) setTimeout(ensureWS, 5_000);
  };

  ws.onerror = () => {}; // errors are handled via onclose
}

// Subscribe to live trade prices for a list of tickers.
// onTrade(ticker, price) fires on every trade.
// Returns an unsubscribe function.
export function subscribeToTrades(tickers, onTrade) {
  if (!isConfigured()) return () => {};

  tradeListeners.add(onTrade);
  ensureWS();

  tickers.forEach(ticker => {
    if (!wsSubscribed.has(ticker)) {
      wsSubscribed.add(ticker);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
      }
    }
  });

  return () => { tradeListeners.delete(onTrade); };
}
