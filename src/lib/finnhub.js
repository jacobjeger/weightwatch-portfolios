// ─── Finnhub market data client ───────────────────────────────────────────────
// API key is exposed client-side (VITE_ prefix). Acceptable for a personal/demo
// app on the free tier — the key only grants market data read access.

const BASE = 'https://finnhub.io/api/v1';
const KEY  = import.meta.env.VITE_FINNHUB_API_KEY;

export const isConfigured = () => Boolean(KEY);

// ── In-memory caches ─────────────────────────────────────────────────────────
const quoteCache  = new Map(); // ticker   → { data, ts }
const candleCache = new Map(); // cacheKey → { data, ts }
const searchCache = new Map(); // query    → { data, ts }
const QUOTE_TTL   = 30_000;   // 30 s  — refresh quotes every 30 s
const CANDLE_TTL  = 300_000;  // 5 min — candles don't change intraday
const SEARCH_TTL  = 60_000;   // 1 min — search results are stable

// ── Quote (current price + daily change) ─────────────────────────────────────
// Returns: { price, change, changePercent, prevClose, high, low, open }
export async function getQuote(ticker) {
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  const res = await fetch(`${BASE}/quote?symbol=${ticker}&token=${KEY}`);
  if (!res.ok) throw new Error(`Quote fetch failed for ${ticker}: ${res.status}`);

  const raw  = await res.json();
  // If Finnhub returns all zeros, the symbol isn't supported — throw so caller falls back
  if (!raw.c) throw new Error(`No data for ${ticker}`);

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

// ── Symbol search ─────────────────────────────────────────────────────────────
// Returns: [{ ticker, name, type, exchange }] matching the query
export async function searchSymbols(query) {
  const q = query.trim();
  if (!q || !KEY) return [];

  const key    = q.toUpperCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) return cached.data;

  try {
    const res  = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&token=${KEY}`);
    if (!res.ok) return [];
    const json = await res.json();

    const data = (json.result ?? [])
      // Keep US stocks and ETFs with simple symbols (no dots/slashes = likely US listed)
      .filter(r =>
        (r.type === 'Common Stock' || r.type === 'ETP') &&
        /^[A-Z]{1,5}$/.test(r.symbol)
      )
      .slice(0, 10)
      .map(r => ({
        ticker:     r.symbol,
        name:       r.description,
        type:       r.type === 'ETP' ? 'ETF' : 'Stock',
        exchange:   r.primaryExchange ?? '',
        last_price: null, // will be fetched on demand by loadTickers
      }));

    searchCache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return [];
  }
}

// ── Portfolio chart data ──────────────────────────────────────────────────────
// Returns: [{ date, portfolio: +5.34, benchmark?: +3.21 }, ...]
// Values are % return from start of range (0 = start date, positive = gain).
const RANGE_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'Max': 1095 };

export async function getRealPortfolioChartData(holdings, benchmarkTicker, range = '1Y') {
  if (!holdings.length) return [];

  const days     = RANGE_DAYS[range] ?? 365;
  const toDate   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  // Fetch all in parallel; catch individual failures gracefully
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
    // Weighted % return from start (0 = flat, +5 = up 5%)
    let portfolio = 0;
    holdings.forEach((h, i) => {
      const start   = startPrices[i] || 1;
      const current = priceMaps[i][date] ?? start;
      portfolio += ((current / start) - 1) * 100 * (h.weight_percent / 100);
    });

    const point = { date, portfolio: parseFloat(portfolio.toFixed(2)) };

    if (benchmarkTicker && startBenchmark > 0) {
      const bPrice = benchMap[date] ?? startBenchmark;
      point.benchmark = parseFloat(((bPrice / startBenchmark - 1) * 100).toFixed(2));
    }

    return point;
  });
}

// ── Staggered fetch helper ──────────────────────────────────────────────────
// Finnhub free tier: 60 calls/min.  Stagger by 200 ms to stay well within.
async function staggeredCandles(tickers, fromDate, toDate) {
  const results = [];
  for (let i = 0; i < tickers.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 200));
    try {
      const data = await getCandles(tickers[i], fromDate, toDate);
      results.push(data);
    } catch (err) {
      console.warn(`[Finnhub] Candle fetch failed for ${tickers[i]}:`, err.message);
      results.push([]);
    }
  }
  return results;
}

// ── Quote-based 1-day returns (always works on free tier) ──────────────────
// Falls back to quote endpoint (price vs prevClose) when candle data is empty.
async function getQuoteBasedReturns(holdings, benchmarkTicker) {
  const tickers = holdings.map(h => h.ticker);
  const allTickers = benchmarkTicker ? [...tickers, benchmarkTicker] : tickers;

  const quotes = {};
  for (let i = 0; i < allTickers.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 150));
    try {
      quotes[allTickers[i]] = await getQuote(allTickers[i]);
    } catch {
      // skip
    }
  }

  let portfolioRet = 0;
  let validWeight  = 0;
  holdings.forEach(h => {
    const q = quotes[h.ticker];
    if (q?.prevClose && q.prevClose > 0 && q.price) {
      const ret = ((q.price / q.prevClose) - 1) * 100;
      portfolioRet += ret * (h.weight_percent / 100);
      validWeight  += h.weight_percent;
    }
  });
  if (validWeight > 0 && validWeight < 100) {
    portfolioRet = portfolioRet * (100 / validWeight);
  }

  let benchRet = null;
  if (benchmarkTicker && quotes[benchmarkTicker]) {
    const q = quotes[benchmarkTicker];
    if (q.prevClose && q.prevClose > 0 && q.price) {
      benchRet = ((q.price / q.prevClose) - 1) * 100;
    }
  }

  return {
    portfolio: validWeight > 0 ? parseFloat(portfolioRet.toFixed(2)) : null,
    benchmark: benchRet != null ? parseFloat(benchRet.toFixed(2)) : null,
  };
}

// ── Performance summary returns (real candle data) ──────────────────────────
// Fetches 1Y of daily candles for all holdings + benchmark, then computes
// weighted portfolio returns for each standard timeframe.
// Falls back to quote-based 1D returns if candle data is unavailable.
// Returns: { portfolio: { '1D': 0.45, '7D': 1.2, ... }, benchmark: { '1D': 0.1, ... } | null }
const PERF_DAYS = { '1D': 1, '7D': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

export async function getRealPerformanceReturns(holdings, benchmarkTicker) {
  if (!holdings.length || !isConfigured()) return null;

  const toDate   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 370 * 86_400_000).toISOString().slice(0, 10); // 370 days to cover weekends

  // Fetch candles with staggering to respect rate limits
  const tickers = holdings.map(h => h.ticker);
  const allTickers = benchmarkTicker ? [...tickers, benchmarkTicker] : tickers;

  console.info('[Finnhub] Fetching candles for', allTickers.length, 'tickers…');
  const candleResults = await staggeredCandles(allTickers, fromDate, toDate);

  const holdingCandles = candleResults.slice(0, tickers.length);
  const benchCandles   = benchmarkTicker ? candleResults[candleResults.length - 1] : [];

  // Log how many tickers got data
  const withData = holdingCandles.filter(c => c.length > 0).length;
  console.info(`[Finnhub] Candle data: ${withData}/${tickers.length} holdings, benchmark: ${benchCandles.length > 0 ? 'yes' : 'no'}`);

  // Build price lookup maps
  const priceMaps = holdingCandles.map(candles => {
    const m = {};
    candles.forEach(d => { m[d.date] = d.price; });
    return m;
  });
  const benchMap = {};
  benchCandles.forEach(d => { benchMap[d.date] = d.price; });

  // Get all trading dates (sorted), use the longest candle set
  const allDates = holdingCandles.reduce((best, c) => c.length > best.length ? c : best, []).map(d => d.date);

  // If no candle data at all, fall back to quote-based 1D returns only
  if (!allDates.length) {
    console.warn('[Finnhub] No candle data available — falling back to quote-based 1D returns');
    const quoteRet = await getQuoteBasedReturns(holdings, benchmarkTicker);
    const result = { portfolio: {}, benchmark: {} };
    for (const label of Object.keys(PERF_DAYS)) {
      if (label === '1D') {
        result.portfolio[label] = quoteRet.portfolio;
        result.benchmark[label] = quoteRet.benchmark;
      } else {
        result.portfolio[label] = null;
        result.benchmark[label] = null;
      }
    }
    // Only return if we got at least 1D data
    return quoteRet.portfolio != null ? result : null;
  }

  const latestDate = allDates[allDates.length - 1];

  function computeReturn(daysBack) {
    // Find the date approximately N calendar days ago
    const targetDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);
    // Find the closest trading date >= targetDate
    const startIdx = allDates.findIndex(d => d >= targetDate);
    if (startIdx < 0 || startIdx >= allDates.length) return { portfolio: null, benchmark: null };
    const startDate = allDates[startIdx];

    // Portfolio weighted return
    let portfolioRet = 0;
    let validWeight = 0;
    holdings.forEach((h, i) => {
      const startPrice = priceMaps[i][startDate];
      const endPrice   = priceMaps[i][latestDate];
      if (startPrice && endPrice && startPrice > 0) {
        const ret = ((endPrice / startPrice) - 1) * 100;
        portfolioRet += ret * (h.weight_percent / 100);
        validWeight += h.weight_percent;
      }
    });

    // Scale up if some holdings had no data
    if (validWeight > 0 && validWeight < 100) {
      portfolioRet = portfolioRet * (100 / validWeight);
    }

    // Benchmark return
    let benchRet = null;
    if (benchmarkTicker) {
      const startB = benchMap[startDate];
      const endB   = benchMap[latestDate];
      if (startB && endB && startB > 0) {
        benchRet = ((endB / startB) - 1) * 100;
      }
    }

    return {
      portfolio: validWeight > 0 ? parseFloat(portfolioRet.toFixed(2)) : null,
      benchmark: benchRet != null ? parseFloat(benchRet.toFixed(2)) : null,
    };
  }

  const result = { portfolio: {}, benchmark: {} };
  for (const [label, days] of Object.entries(PERF_DAYS)) {
    const r = computeReturn(days);
    result.portfolio[label] = r.portfolio;
    result.benchmark[label] = r.benchmark;
  }

  // If candle-based 1D is null (no recent candle), supplement with quote data
  if (result.portfolio['1D'] == null) {
    const quoteRet = await getQuoteBasedReturns(holdings, benchmarkTicker);
    result.portfolio['1D'] = quoteRet.portfolio;
    result.benchmark['1D'] = quoteRet.benchmark;
  }

  return result;
}

// ── WebSocket — real-time trade feed ─────────────────────────────────────────
let ws             = null;
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
    if (wsSubscribed.size > 0) setTimeout(ensureWS, 5_000);
  };

  ws.onerror = () => {}; // errors handled via onclose
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
