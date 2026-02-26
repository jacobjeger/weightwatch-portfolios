// ─── Finnhub market data client ───────────────────────────────────────────────
// API key is exposed client-side (VITE_ prefix). Acceptable for a personal/demo
// app on the free tier — the key only grants market data read access.
//
// Historical candle data: tries Finnhub first; if the free-tier returns 403,
// automatically falls back to Yahoo Finance (via /api/yahoo-chart proxy) for
// all subsequent requests.  This gives us free unlimited historical data.

import { getYahooCandles, clearYahooCache } from './yahoo';

const BASE = 'https://finnhub.io/api/v1';
const KEY  = import.meta.env.VITE_FINNHUB_API_KEY;

export const isConfigured = () => Boolean(KEY);

// ── Index ticker → ETF mapping ───────────────────────────────────────────────
// CBOE/Yahoo-style index tickers don't work on Finnhub free tier.
// Map them to their ETF equivalents for quotes, WebSocket, and candles.
const INDEX_TO_ETF = {
  // CBOE-style
  'SPX':    'SPY',
  'NDX':    'QQQ',
  'RUT':    'IWM',
  'DJI':    'DIA',
  'DJIA':   'DIA',
  // Yahoo-style (caret prefix)
  '^GSPC':  'SPY',
  '^DJI':   'DIA',
  '^IXIC':  'QQQ',
  '^RUT':   'IWM',
  '^VIX':   'VIXY',
  '^TNX':   'TLT',
};

/** Normalize a ticker: map index symbols to their ETF equivalents for Finnhub. */
export function normalizeTicker(ticker) {
  if (!ticker) return ticker;
  const upper = ticker.toUpperCase();
  return INDEX_TO_ETF[upper] || ticker;
}

// After the first 403 from Finnhub candles, switch permanently to Yahoo
let candleSource = 'finnhub'; // 'finnhub' | 'yahoo'

// ── In-memory caches ─────────────────────────────────────────────────────────
const quoteCache  = new Map(); // ticker   → { data, ts }
const candleCache = new Map(); // cacheKey → { data, ts }
const searchCache = new Map(); // query    → { data, ts }
const QUOTE_TTL   = 30_000;   // 30 s  — refresh quotes every 30 s
const CANDLE_TTL  = 300_000;  // 5 min — candles don't change intraday
const SEARCH_TTL  = 60_000;   // 1 min — search results are stable

/** Bust all in-memory market-data caches (Finnhub + Yahoo). */
export function clearMarketCaches() {
  quoteCache.clear();
  candleCache.clear();
  searchCache.clear();
  clearYahooCache();
}

// ── Quote (current price + daily change) ─────────────────────────────────────
// Returns: { price, change, changePercent, prevClose, high, low, open }
export async function getQuote(ticker) {
  const symbol = normalizeTicker(ticker);
  // Cache under original ticker so callers get consistent results
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  const res = await fetch(`${BASE}/quote?symbol=${symbol}&token=${KEY}`);
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
  const symbol = normalizeTicker(ticker);
  const cacheKey = `${ticker}:${fromDate}:${toDate}`;
  const cached   = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CANDLE_TTL) return cached.data;

  const from = Math.floor(new Date(fromDate).getTime() / 1000);
  const to   = Math.floor(new Date(toDate).getTime()   / 1000);

  const res = await fetch(
    `${BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${KEY}`
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

// ── Unified candle fetcher (auto-fallback Finnhub → Yahoo) ─────────────────
// Tries Finnhub candles first; on 403 switches to Yahoo Finance permanently.
// Returns same format: [{ date, price }, ...]
async function getHistoricalCandles(ticker, fromDate, toDate) {
  // Already switched to Yahoo — go straight there
  if (candleSource === 'yahoo') {
    return getYahooCandles(ticker, fromDate, toDate);
  }

  try {
    const data = await getCandles(ticker, fromDate, toDate);
    return data;
  } catch (err) {
    // Finnhub free tier returns 403 for candle endpoint — switch to Yahoo
    if (err.message.includes('403')) {
      console.info('[Market Data] Finnhub candles returned 403 — switching to Yahoo Finance (free)');
      candleSource = 'yahoo';
      return getYahooCandles(ticker, fromDate, toDate);
    }
    throw err;
  }
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
const RANGE_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, 'Max': 1095 };

export async function getRealPortfolioChartData(holdings, benchmarkTicker, range = '1Y') {
  if (!holdings.length) return [];

  const days     = RANGE_DAYS[range] ?? 365;
  const toDate   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  // Fetch all via unified candle fetcher (auto-fallback Finnhub → Yahoo)
  const [holdingCandles, benchCandles] = await Promise.all([
    Promise.all(holdings.map(h => getHistoricalCandles(h.ticker, fromDate, toDate).catch(() => []))),
    benchmarkTicker
      ? getHistoricalCandles(benchmarkTicker, fromDate, toDate).catch(() => [])
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

// ── Individual Holdings chart data ───────────────────────────────────────────
// Returns: [{ date, AAPL: +5.3, MSFT: +2.1, ... }, ...]
// Each holding is its own key with % return from start of range.
const HOLDINGS_RANGE_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, 'Max': 1095 };

export async function getRealHoldingsChartData(holdings, range = '6M') {
  if (!holdings.length || !isConfigured()) return null;

  const days     = HOLDINGS_RANGE_DAYS[range] ?? 180;
  const toDate   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const tickers = holdings.map(h => h.ticker);
  const candleResults = await staggeredCandles(tickers, fromDate, toDate);

  // Find the longest candle set for date alignment
  const longest = candleResults.reduce((best, c) => c.length > best.length ? c : best, []);
  const dates = longest.map(d => d.date);
  if (!dates.length) return null;

  // Build price lookup maps
  const priceMaps = candleResults.map(candles => {
    const m = {};
    candles.forEach(d => { m[d.date] = d.price; });
    return m;
  });

  const startPrices = candleResults.map(c => c[0]?.price ?? null);

  return dates.map(date => {
    const entry = { date };
    holdings.forEach((h, i) => {
      const start = startPrices[i];
      if (start && start > 0) {
        const current = priceMaps[i][date] ?? start;
        entry[h.ticker] = parseFloat(((current / start - 1) * 100).toFixed(2));
      } else {
        entry[h.ticker] = 0;
      }
    });
    return entry;
  });
}

// ── Staggered fetch helper ──────────────────────────────────────────────────
// Stagger requests to stay within rate limits.  Uses getHistoricalCandles
// which auto-falls-back from Finnhub to Yahoo Finance.
async function staggeredCandles(tickers, fromDate, toDate) {
  const results = [];
  for (let i = 0; i < tickers.length; i++) {
    // Smaller delay for Yahoo (no rate limit), 200 ms for Finnhub
    if (i > 0) await new Promise(r => setTimeout(r, candleSource === 'yahoo' ? 50 : 200));
    try {
      const data = await getHistoricalCandles(tickers[i], fromDate, toDate);
      results.push(data);
    } catch (err) {
      console.warn(`[${candleSource === 'yahoo' ? 'Yahoo' : 'Finnhub'}] Candle fetch failed for ${tickers[i]}:`, err.message);
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
const PERF_DAYS = { '1D': 1, '7D': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730 };

export async function getRealPerformanceReturns(holdings, benchmarkTicker) {
  if (!holdings.length || !isConfigured()) return null;

  const toDate   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 740 * 86_400_000).toISOString().slice(0, 10); // 740 days to cover 2Y + weekends

  // Fetch candles with staggering to respect rate limits
  const tickers = holdings.map(h => h.ticker);
  const allTickers = benchmarkTicker ? [...tickers, benchmarkTicker] : tickers;

  const src = candleSource === 'yahoo' ? 'Yahoo' : 'Finnhub';
  console.info(`[${src}] Fetching candles for`, allTickers.length, 'tickers…');
  const candleResults = await staggeredCandles(allTickers, fromDate, toDate);

  const holdingCandles = candleResults.slice(0, tickers.length);
  const benchCandles   = benchmarkTicker ? candleResults[candleResults.length - 1] : [];

  // Log how many tickers got data
  const withData = holdingCandles.filter(c => c.length > 0).length;
  const srcNow = candleSource === 'yahoo' ? 'Yahoo' : 'Finnhub';
  console.info(`[${srcNow}] Candle data: ${withData}/${tickers.length} holdings, benchmark: ${benchCandles.length > 0 ? 'yes' : 'no'}`);

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
    console.warn(`[${srcNow}] No candle data available — falling back to quote-based 1D returns`);
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

  // YTD: compute from Jan 1 of the current year
  const ytdDays = Math.floor((Date.now() - new Date(`${new Date().getFullYear()}-01-01`).getTime()) / 86_400_000);
  if (ytdDays > 0) {
    const ytdR = computeReturn(ytdDays);
    result.portfolio['YTD'] = ytdR.portfolio;
    result.benchmark['YTD'] = ytdR.benchmark;
  }

  // If candle-based 1D is null (no recent candle), supplement with quote data
  if (result.portfolio['1D'] == null) {
    const quoteRet = await getQuoteBasedReturns(holdings, benchmarkTicker);
    result.portfolio['1D'] = quoteRet.portfolio;
    result.benchmark['1D'] = quoteRet.benchmark;
  }

  return result;
}

// ── Real risk metrics from candle data ──────────────────────────────────────
// Computes volatility, max drawdown, Sharpe, and Sortino from real market data.
const RISK_FREE_RATE = 0.05;

export async function getRealRiskMetrics(holdings, benchmarkTicker, range = '1Y') {
  if (!holdings.length || !isConfigured()) return null;

  const days = RANGE_DAYS[range] ?? 365;
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const tickers = holdings.map(h => h.ticker);
  const allTickers = benchmarkTicker ? [...tickers, benchmarkTicker] : tickers;
  const candleResults = await staggeredCandles(allTickers, fromDate, toDate);

  const holdingCandles = candleResults.slice(0, tickers.length);
  const benchCandles = benchmarkTicker ? candleResults[candleResults.length - 1] : [];

  // Build composite portfolio price series
  const dates = holdingCandles.reduce((best, c) => c.length > best.length ? c : best, []).map(d => d.date);
  if (!dates.length) return null;

  const priceMaps = holdingCandles.map(candles => {
    const m = {};
    candles.forEach(d => { m[d.date] = d.price; });
    return m;
  });

  const startPrices = holdingCandles.map(c => c[0]?.price ?? null);
  const portfolioPrices = dates.map(date => {
    let val = 0;
    holdings.forEach((h, i) => {
      const start = startPrices[i];
      if (start && start > 0) {
        val += (h.weight_percent / 100) * ((priceMaps[i][date] ?? start) / start);
      }
    });
    return val || 1;
  });

  function computeMetrics(prices, tradingDays) {
    if (prices.length < 2) return { volatility: 0, maxDrawdown: 0, sharpe: 0, sortino: 0 };
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) returns.push(prices[i] / prices[i - 1] - 1);
    }
    // Volatility
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const vol = Math.sqrt(variance * 252) * 100;
    // Max drawdown
    let peak = prices[0], worstDd = 0;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) peak = prices[i];
      const dd = (prices[i] - peak) / peak;
      if (dd < worstDd) worstDd = dd;
    }
    // Sharpe
    const totalReturn = prices[prices.length - 1] / prices[0] - 1;
    const annReturn = Math.pow(1 + totalReturn, 252 / tradingDays) - 1;
    const sharpe = vol > 0 ? (annReturn - RISK_FREE_RATE) / (vol / 100) : 0;
    // Sortino
    const dailyRf = Math.pow(1 + RISK_FREE_RATE, 1 / 252) - 1;
    const downReturns = returns.filter(r => r < dailyRf).map(r => r - dailyRf);
    const downVar = downReturns.length > 0
      ? downReturns.reduce((s, r) => s + r ** 2, 0) / downReturns.length
      : 0;
    const downVol = Math.sqrt(downVar * 252);
    const sortino = downVol > 0 ? (annReturn - RISK_FREE_RATE) / downVol : (annReturn > RISK_FREE_RATE ? 99 : 0);

    return {
      volatility: parseFloat(vol.toFixed(2)),
      maxDrawdown: parseFloat((worstDd * 100).toFixed(2)),
      sharpe: parseFloat(sharpe.toFixed(2)),
      sortino: parseFloat(sortino.toFixed(2)),
    };
  }

  const result = { portfolio: computeMetrics(portfolioPrices, dates.length) };

  if (benchmarkTicker && benchCandles.length > 1) {
    result.benchmark = computeMetrics(benchCandles.map(d => d.price), benchCandles.length);
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
// Internally maps index tickers to ETF equivalents and maps trades back to original tickers.
export function subscribeToTrades(tickers, onTrade) {
  if (!isConfigured()) return () => {};

  // Build a reverse mapping: normalized symbol → original ticker(s)
  const reverseMap = {};
  tickers.forEach(t => {
    const norm = normalizeTicker(t);
    if (!reverseMap[norm]) reverseMap[norm] = [];
    reverseMap[norm].push(t);
  });

  // Wrap onTrade to translate ETF symbols back to original index tickers
  const wrappedOnTrade = (symbol, price) => {
    // Fire for the ETF symbol's mapped original tickers
    const originals = reverseMap[symbol];
    if (originals) {
      originals.forEach(orig => onTrade(orig, price));
    }
    // Also fire for exact matches (non-mapped tickers)
    if (!originals || !originals.includes(symbol)) {
      onTrade(symbol, price);
    }
  };

  tradeListeners.add(wrappedOnTrade);
  ensureWS();

  // Subscribe using normalized (ETF) symbols
  Object.keys(reverseMap).forEach(symbol => {
    if (!wsSubscribed.has(symbol)) {
      wsSubscribed.add(symbol);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', symbol }));
      }
    }
  });

  return () => { tradeListeners.delete(wrappedOnTrade); };
}
