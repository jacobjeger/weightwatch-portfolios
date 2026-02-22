import { format, subDays } from 'date-fns';

// ─── Instrument list ──────────────────────────────────────────────────────────
export const INSTRUMENTS = [
  // Broad market ETFs
  { ticker: 'SPY',  name: 'SPDR S&P 500 ETF Trust',             type: 'ETF',   exchange: 'NYSE',   last_price: 596.41 },
  { ticker: 'QQQ',  name: 'Invesco QQQ Trust (NASDAQ-100)',      type: 'ETF',   exchange: 'NASDAQ', last_price: 510.83 },
  { ticker: 'IWM',  name: 'iShares Russell 2000 ETF',            type: 'ETF',   exchange: 'NYSE',   last_price: 228.15 },
  { ticker: 'DIA',  name: 'SPDR Dow Jones Industrial Average ETF', type: 'ETF', exchange: 'NYSE',   last_price: 440.22 },
  { ticker: 'EFA',  name: 'iShares MSCI EAFE ETF',               type: 'ETF',   exchange: 'NYSE',   last_price: 78.44  },
  { ticker: 'ACWI', name: 'iShares MSCI ACWI ETF',               type: 'ETF',   exchange: 'NASDAQ', last_price: 110.62 },
  { ticker: 'EEM',  name: 'iShares MSCI Emerging Markets ETF',   type: 'ETF',   exchange: 'NYSE',   last_price: 44.18  },
  // Bond ETFs
  { ticker: 'AGG',  name: 'iShares Core U.S. Aggregate Bond',    type: 'ETF',   exchange: 'NYSE',   last_price: 97.20  },
  { ticker: 'BND',  name: 'Vanguard Total Bond Market ETF',      type: 'ETF',   exchange: 'NASDAQ', last_price: 73.88  },
  { ticker: 'TLT',  name: 'iShares 20+ Year Treasury Bond ETF',  type: 'ETF',   exchange: 'NASDAQ', last_price: 91.27  },
  { ticker: 'HYG',  name: 'iShares iBoxx High Yield Corp Bond',  type: 'ETF',   exchange: 'NYSE',   last_price: 78.54  },
  { ticker: 'LQD',  name: 'iShares iBoxx Investment Grade Corp', type: 'ETF',   exchange: 'NYSE',   last_price: 107.43 },
  { ticker: 'TIPS', name: 'iShares TIPS Bond ETF',               type: 'ETF',   exchange: 'NYSE',   last_price: 107.82 },
  // Other ETFs
  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',                type: 'ETF',   exchange: 'NYSE',   last_price: 548.12 },
  { ticker: 'VTI',  name: 'Vanguard Total Stock Market ETF',     type: 'ETF',   exchange: 'NYSE',   last_price: 278.96 },
  { ticker: 'VGT',  name: 'Vanguard Information Technology ETF', type: 'ETF',   exchange: 'NYSE',   last_price: 587.34 },
  { ticker: 'VNQ',  name: 'Vanguard Real Estate ETF',            type: 'ETF',   exchange: 'NYSE',   last_price: 84.51  },
  { ticker: 'VWO',  name: 'Vanguard FTSE Emerging Markets ETF',  type: 'ETF',   exchange: 'NYSE',   last_price: 43.12  },
  { ticker: 'GLD',  name: 'SPDR Gold Shares',                    type: 'ETF',   exchange: 'NYSE',   last_price: 243.89 },
  { ticker: 'SLV',  name: 'iShares Silver Trust',                type: 'ETF',   exchange: 'NYSE',   last_price: 27.43  },
  { ticker: 'XLK',  name: 'Technology Select Sector SPDR',       type: 'ETF',   exchange: 'NYSE',   last_price: 228.43 },
  { ticker: 'XLF',  name: 'Financial Select Sector SPDR',        type: 'ETF',   exchange: 'NYSE',   last_price: 48.82  },
  { ticker: 'XLE',  name: 'Energy Select Sector SPDR',           type: 'ETF',   exchange: 'NYSE',   last_price: 92.17  },
  { ticker: 'XLV',  name: 'Health Care Select Sector SPDR',      type: 'ETF',   exchange: 'NYSE',   last_price: 138.95 },
  { ticker: 'XLI',  name: 'Industrial Select Sector SPDR',       type: 'ETF',   exchange: 'NYSE',   last_price: 133.72 },
  { ticker: 'XLY',  name: 'Consumer Discretionary Select Sector',type: 'ETF',   exchange: 'NYSE',   last_price: 212.38 },
  { ticker: 'XLRE', name: 'Real Estate Select Sector SPDR',      type: 'ETF',   exchange: 'NYSE',   last_price: 42.16  },
  { ticker: 'ARKK', name: 'ARK Innovation ETF',                  type: 'ETF',   exchange: 'NYSE',   last_price: 52.34  },
  { ticker: 'TQQQ', name: 'ProShares UltraPro QQQ',              type: 'ETF',   exchange: 'NASDAQ', last_price: 68.14  },
  { ticker: 'SQQQ', name: 'ProShares UltraPro Short QQQ',        type: 'ETF',   exchange: 'NASDAQ', last_price: 9.43   },
  { ticker: 'SOXX', name: 'iShares Semiconductor ETF',           type: 'ETF',   exchange: 'NASDAQ', last_price: 248.71 },
  // Large-cap Tech
  { ticker: 'AAPL', name: 'Apple Inc.',                          type: 'Stock', exchange: 'NASDAQ', last_price: 228.52 },
  { ticker: 'MSFT', name: 'Microsoft Corporation',               type: 'Stock', exchange: 'NASDAQ', last_price: 415.40 },
  { ticker: 'GOOGL',name: 'Alphabet Inc. Class A',               type: 'Stock', exchange: 'NASDAQ', last_price: 194.75 },
  { ticker: 'GOOG', name: 'Alphabet Inc. Class C',               type: 'Stock', exchange: 'NASDAQ', last_price: 196.08 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.',                     type: 'Stock', exchange: 'NASDAQ', last_price: 224.80 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation',                  type: 'Stock', exchange: 'NASDAQ', last_price: 873.22 },
  { ticker: 'META', name: 'Meta Platforms Inc.',                 type: 'Stock', exchange: 'NASDAQ', last_price: 589.70 },
  { ticker: 'TSLA', name: 'Tesla Inc.',                          type: 'Stock', exchange: 'NASDAQ', last_price: 354.45 },
  { ticker: 'ADBE', name: 'Adobe Inc.',                          type: 'Stock', exchange: 'NASDAQ', last_price: 524.83 },
  { ticker: 'CRM',  name: 'Salesforce Inc.',                     type: 'Stock', exchange: 'NYSE',   last_price: 303.14 },
  { ticker: 'NFLX', name: 'Netflix Inc.',                        type: 'Stock', exchange: 'NASDAQ', last_price: 760.94 },
  { ticker: 'ORCL', name: 'Oracle Corporation',                  type: 'Stock', exchange: 'NYSE',   last_price: 174.22 },
  { ticker: 'NOW',  name: 'ServiceNow Inc.',                     type: 'Stock', exchange: 'NYSE',   last_price: 940.18 },
  { ticker: 'SHOP', name: 'Shopify Inc.',                        type: 'Stock', exchange: 'NYSE',   last_price: 117.48 },
  { ticker: 'UBER', name: 'Uber Technologies Inc.',              type: 'Stock', exchange: 'NYSE',   last_price: 74.92  },
  { ticker: 'SPOT', name: 'Spotify Technology S.A.',             type: 'Stock', exchange: 'NYSE',   last_price: 477.51 },
  { ticker: 'APP',  name: 'Applovin Corporation',                type: 'Stock', exchange: 'NASDAQ', last_price: 342.15 },
  // Semiconductors
  { ticker: 'AMD',  name: 'Advanced Micro Devices Inc.',         type: 'Stock', exchange: 'NASDAQ', last_price: 178.83 },
  { ticker: 'INTC', name: 'Intel Corporation',                   type: 'Stock', exchange: 'NASDAQ', last_price: 24.38  },
  { ticker: 'QCOM', name: 'Qualcomm Inc.',                       type: 'Stock', exchange: 'NASDAQ', last_price: 186.40 },
  { ticker: 'AVGO', name: 'Broadcom Inc.',                       type: 'Stock', exchange: 'NASDAQ', last_price: 1743.60},
  { ticker: 'TXN',  name: 'Texas Instruments Inc.',              type: 'Stock', exchange: 'NASDAQ', last_price: 195.87 },
  { ticker: 'MU',   name: 'Micron Technology Inc.',              type: 'Stock', exchange: 'NASDAQ', last_price: 108.42 },
  { ticker: 'AMAT', name: 'Applied Materials Inc.',              type: 'Stock', exchange: 'NASDAQ', last_price: 192.76 },
  { ticker: 'LRCX', name: 'Lam Research Corporation',           type: 'Stock', exchange: 'NASDAQ', last_price: 817.29 },
  { ticker: 'KLAC', name: 'KLA Corporation',                    type: 'Stock', exchange: 'NASDAQ', last_price: 812.47 },
  { ticker: 'ARM',  name: 'Arm Holdings plc',                   type: 'Stock', exchange: 'NASDAQ', last_price: 148.32 },
  // Financials
  { ticker: 'JPM',  name: 'JPMorgan Chase & Co.',                type: 'Stock', exchange: 'NYSE',   last_price: 244.78 },
  { ticker: 'BAC',  name: 'Bank of America Corporation',         type: 'Stock', exchange: 'NYSE',   last_price: 44.36  },
  { ticker: 'GS',   name: 'Goldman Sachs Group Inc.',            type: 'Stock', exchange: 'NYSE',   last_price: 584.20 },
  { ticker: 'MS',   name: 'Morgan Stanley',                      type: 'Stock', exchange: 'NYSE',   last_price: 128.55 },
  { ticker: 'WFC',  name: 'Wells Fargo & Company',               type: 'Stock', exchange: 'NYSE',   last_price: 76.34  },
  { ticker: 'V',    name: 'Visa Inc.',                           type: 'Stock', exchange: 'NYSE',   last_price: 314.92 },
  { ticker: 'MA',   name: 'Mastercard Incorporated',             type: 'Stock', exchange: 'NYSE',   last_price: 522.18 },
  { ticker: 'AXP',  name: 'American Express Company',            type: 'Stock', exchange: 'NYSE',   last_price: 290.44 },
  { ticker: 'BLK',  name: 'BlackRock Inc.',                      type: 'Stock', exchange: 'NYSE',   last_price: 1012.34},
  { ticker: 'SCHW', name: 'Charles Schwab Corporation',          type: 'Stock', exchange: 'NYSE',   last_price: 78.14  },
  { ticker: 'COF',  name: 'Capital One Financial Corporation',   type: 'Stock', exchange: 'NYSE',   last_price: 192.80 },
  // Healthcare & Pharma
  { ticker: 'AMGN', name: 'Amgen Inc.',                          type: 'Stock', exchange: 'NASDAQ', last_price: 268.79 },
  { ticker: 'JNJ',  name: 'Johnson & Johnson',                   type: 'Stock', exchange: 'NYSE',   last_price: 162.40 },
  { ticker: 'UNH',  name: 'UnitedHealth Group Incorporated',     type: 'Stock', exchange: 'NYSE',   last_price: 524.15 },
  { ticker: 'PFE',  name: 'Pfizer Inc.',                         type: 'Stock', exchange: 'NYSE',   last_price: 28.57  },
  { ticker: 'ABBV', name: 'AbbVie Inc.',                         type: 'Stock', exchange: 'NYSE',   last_price: 175.43 },
  { ticker: 'LLY',  name: 'Eli Lilly and Company',              type: 'Stock', exchange: 'NYSE',   last_price: 798.45 },
  { ticker: 'MRK',  name: 'Merck & Co. Inc.',                   type: 'Stock', exchange: 'NYSE',   last_price: 103.22 },
  { ticker: 'GILD', name: 'Gilead Sciences Inc.',               type: 'Stock', exchange: 'NASDAQ', last_price: 90.14  },
  { ticker: 'ISRG', name: 'Intuitive Surgical Inc.',            type: 'Stock', exchange: 'NASDAQ', last_price: 524.82 },
  // Consumer
  { ticker: 'PG',   name: 'Procter & Gamble Co.',                type: 'Stock', exchange: 'NYSE',   last_price: 165.82 },
  { ticker: 'HD',   name: 'Home Depot Inc.',                     type: 'Stock', exchange: 'NYSE',   last_price: 407.26 },
  { ticker: 'DIS',  name: 'Walt Disney Company',                 type: 'Stock', exchange: 'NYSE',   last_price: 114.27 },
  { ticker: 'COST', name: 'Costco Wholesale Corporation',        type: 'Stock', exchange: 'NASDAQ', last_price: 958.43 },
  { ticker: 'WMT',  name: 'Walmart Inc.',                        type: 'Stock', exchange: 'NYSE',   last_price: 93.52  },
  { ticker: 'TGT',  name: 'Target Corporation',                  type: 'Stock', exchange: 'NYSE',   last_price: 139.24 },
  { ticker: 'MCD',  name: "McDonald's Corporation",              type: 'Stock', exchange: 'NYSE',   last_price: 298.76 },
  { ticker: 'SBUX', name: 'Starbucks Corporation',               type: 'Stock', exchange: 'NASDAQ', last_price: 92.44  },
  { ticker: 'NKE',  name: 'Nike Inc.',                           type: 'Stock', exchange: 'NYSE',   last_price: 81.23  },
  { ticker: 'KO',   name: 'Coca-Cola Company',                   type: 'Stock', exchange: 'NYSE',   last_price: 63.18  },
  { ticker: 'PEP',  name: 'PepsiCo Inc.',                        type: 'Stock', exchange: 'NASDAQ', last_price: 152.42 },
  // Energy
  { ticker: 'XOM',  name: 'Exxon Mobil Corporation',             type: 'Stock', exchange: 'NYSE',   last_price: 112.84 },
  { ticker: 'CVX',  name: 'Chevron Corporation',                 type: 'Stock', exchange: 'NYSE',   last_price: 163.52 },
  { ticker: 'COP',  name: 'ConocoPhillips',                      type: 'Stock', exchange: 'NYSE',   last_price: 116.39 },
  { ticker: 'SLB',  name: 'Schlumberger N.V.',                   type: 'Stock', exchange: 'NYSE',   last_price: 44.82  },
  // Industrials / Other
  { ticker: 'CAT',  name: 'Caterpillar Inc.',                    type: 'Stock', exchange: 'NYSE',   last_price: 390.47 },
  { ticker: 'BA',   name: 'Boeing Company',                      type: 'Stock', exchange: 'NYSE',   last_price: 170.38 },
  { ticker: 'GE',   name: 'GE Aerospace',                        type: 'Stock', exchange: 'NYSE',   last_price: 192.85 },
  { ticker: 'HON',  name: 'Honeywell International Inc.',        type: 'Stock', exchange: 'NASDAQ', last_price: 214.63 },
  { ticker: 'RTX',  name: 'RTX Corporation',                     type: 'Stock', exchange: 'NYSE',   last_price: 131.44 },
  { ticker: 'LMT',  name: 'Lockheed Martin Corporation',         type: 'Stock', exchange: 'NYSE',   last_price: 500.78 },
  { ticker: 'UPS',  name: 'United Parcel Service Inc.',          type: 'Stock', exchange: 'NYSE',   last_price: 129.54 },
  { ticker: 'FDX',  name: 'FedEx Corporation',                   type: 'Stock', exchange: 'NYSE',   last_price: 282.41 },
  { ticker: 'BRK.B',name: 'Berkshire Hathaway Inc. Class B',    type: 'Stock', exchange: 'NYSE',   last_price: 450.91 },
  // Fintech / Growth
  { ticker: 'PYPL', name: 'PayPal Holdings Inc.',                type: 'Stock', exchange: 'NASDAQ', last_price: 86.93  },
  { ticker: 'SNOW', name: 'Snowflake Inc.',                      type: 'Stock', exchange: 'NYSE',   last_price: 146.38 },
  { ticker: 'PLTR', name: 'Palantir Technologies Inc.',          type: 'Stock', exchange: 'NYSE',   last_price: 38.15  },
  { ticker: 'COIN', name: 'Coinbase Global Inc.',                type: 'Stock', exchange: 'NASDAQ', last_price: 218.74 },
  { ticker: 'RBLX', name: 'Roblox Corporation',                  type: 'Stock', exchange: 'NYSE',   last_price: 42.31  },
  { ticker: 'DDOG', name: 'Datadog Inc.',                        type: 'Stock', exchange: 'NASDAQ', last_price: 121.48 },
  { ticker: 'CRWD', name: 'CrowdStrike Holdings Inc.',           type: 'Stock', exchange: 'NASDAQ', last_price: 368.92 },
  { ticker: 'ZS',   name: 'Zscaler Inc.',                        type: 'Stock', exchange: 'NASDAQ', last_price: 212.54 },
  { ticker: 'NET',  name: 'Cloudflare Inc.',                     type: 'Stock', exchange: 'NYSE',   last_price: 117.82 },
  { ticker: 'S',    name: 'SentinelOne Inc.',                    type: 'Stock', exchange: 'NYSE',   last_price: 21.45  },
  // Telecom / Media
  { ticker: 'T',    name: 'AT&T Inc.',                           type: 'Stock', exchange: 'NYSE',   last_price: 19.87  },
  { ticker: 'VZ',   name: 'Verizon Communications Inc.',         type: 'Stock', exchange: 'NYSE',   last_price: 41.23  },
  { ticker: 'CMCSA',name: 'Comcast Corporation',                 type: 'Stock', exchange: 'NASDAQ', last_price: 40.88  },
];

// ─── Benchmark indexes ────────────────────────────────────────────────────────
// These use real index symbols (^ prefix) as used by Finnhub and most data providers.
export const BENCHMARKS = ['^GSPC', '^NDX', '^RUT', '^DJI', 'EFA', 'AGG'];

export const BENCHMARK_META = {
  '^GSPC': { label: 'S&P 500',          description: 'Large-cap US equities (500 companies)',    color: '#3b82f6' },
  '^NDX':  { label: 'NASDAQ-100',       description: 'Top 100 NASDAQ non-financial companies',   color: '#8b5cf6' },
  '^RUT':  { label: 'Russell 2000',     description: 'US small-cap equities (2,000 companies)',  color: '#f59e0b' },
  '^DJI':  { label: 'Dow Jones 30',     description: '30 blue-chip US industrial companies',     color: '#10b981' },
  'EFA':   { label: 'MSCI EAFE',        description: 'Developed international markets ex-US',    color: '#06b6d4' },
  'AGG':   { label: 'US Aggregate Bond',description: 'Investment-grade US bond market',          color: '#6b7280' },
};

// ─── Seeded random ────────────────────────────────────────────────────────────
function seedRand(seed) {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tickerHash(ticker) {
  let h = 5381;
  for (let i = 0; i < ticker.length; i++) {
    h = ((h << 5) + h + ticker.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

// ─── Historical price generation ─────────────────────────────────────────────
const VOLATILITY = {
  ETF:   0.007,
  Index: 0.007,  // same as ETF — indices are diversified
  Stock: 0.016,
};

const DRIFT = 0.00035; // slight upward drift per trading day

// Returns array of {date, price} from oldest to newest, ending near last_price.
export function generateHistory(ticker, numDays = 504) {
  const inst = INSTRUMENTS.find((i) => i.ticker === ticker);
  const currentPrice = inst?.last_price ?? 100;
  // Indices (^ prefix) and ETFs get lower volatility
  const isIndex = ticker.startsWith('^');
  const vol = (inst?.type === 'ETF' || isIndex) ? VOLATILITY.ETF : VOLATILITY.Stock;
  const rand = seedRand(tickerHash(ticker));

  // Generate daily returns
  const returns = Array.from({ length: numDays - 1 }, () => {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return DRIFT + vol * normal;
  });

  // Reconstruct prices backward from current
  const prices = [currentPrice];
  for (let i = returns.length - 1; i >= 0; i--) {
    prices.unshift(prices[0] / (1 + returns[i]));
  }

  // Generate trading dates
  const today = new Date();
  const dates = [];
  let d = new Date(today);
  while (dates.length < numDays) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dates.unshift(format(d, 'yyyy-MM-dd'));
    d = subDays(d, 1);
  }

  return dates.map((date, i) => ({ date, price: prices[i] }));
}

// ─── Performance calculation ──────────────────────────────────────────────────
const RANGE_DAYS = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, Max: 504 };

// Returns [{ date, portfolio: +5.34, benchmark?: +3.21 }]
// Values are % return from the start of the range (0 = start, +5 = up 5%).
export function getPortfolioChartData(holdings, benchmarkTicker, range = '1Y') {
  const numDays = RANGE_DAYS[range] ?? 252;

  if (!holdings || holdings.length === 0) {
    if (!benchmarkTicker) return [];
    const bHist = generateHistory(benchmarkTicker, numDays);
    const b0 = bHist[0].price;
    return bHist.map((p) => ({
      date:      p.date,
      benchmark: parseFloat(((p.price / b0 - 1) * 100).toFixed(2)),
    }));
  }

  const histories = holdings.map((h) => ({
    weight: h.weight_percent / 100,
    prices: generateHistory(h.ticker, numDays).map((p) => p.price),
  }));

  const benchHistory = benchmarkTicker
    ? generateHistory(benchmarkTicker, numDays).map((p) => p.price)
    : null;

  const dates = generateHistory(holdings[0].ticker, numDays).map((p) => p.date);

  return dates.map((date, i) => {
    // Weighted % return from start
    const portfolio = histories.reduce((sum, h) => {
      return sum + h.weight * ((h.prices[i] / h.prices[0]) - 1) * 100;
    }, 0);

    const entry = { date, portfolio: parseFloat(portfolio.toFixed(2)) };

    if (benchHistory) {
      entry.benchmark = parseFloat(((benchHistory[i] / benchHistory[0] - 1) * 100).toFixed(2));
    }

    return entry;
  });
}

// Returns a single return % over a number of trading days
export function getReturn(ticker, tradingDays) {
  const hist = generateHistory(ticker, tradingDays + 1);
  return ((hist[hist.length - 1].price / hist[0].price - 1) * 100).toFixed(2);
}

// YTD = from Jan 1 to today
export function getYTDReturn(ticker) {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const diffMs = today - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const tradingDays = Math.round(diffDays * (252 / 365));
  return getReturn(ticker, Math.max(tradingDays, 1));
}

export function getPortfolioReturn(holdings, tradingDays) {
  if (!holdings || holdings.length === 0) return '0.00';
  const total = holdings.reduce((sum, h) => {
    return sum + (h.weight_percent / 100) * parseFloat(getReturn(h.ticker, tradingDays));
  }, 0);
  return total.toFixed(2);
}

// ─── Demo seed portfolios ─────────────────────────────────────────────────────
export function createDemoPortfolios(userId) {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-1',
      owner: userId,
      name: 'Tech Growth',
      description: 'Concentrated US mega-cap tech exposure',
      primary_benchmark: '^NDX',
      secondary_benchmarks: [],
      created_at: now,
      last_updated_at: now,
      holdings: [
        { ticker: 'AAPL',  name: 'Apple Inc.',             type: 'Stock', last_price: 228.52, weight_percent: 25 },
        { ticker: 'MSFT',  name: 'Microsoft Corporation',  type: 'Stock', last_price: 415.40, weight_percent: 25 },
        { ticker: 'GOOGL', name: 'Alphabet Inc. Class A',  type: 'Stock', last_price: 194.75, weight_percent: 20 },
        { ticker: 'NVDA',  name: 'NVIDIA Corporation',     type: 'Stock', last_price: 873.22, weight_percent: 20 },
        { ticker: 'AMZN',  name: 'Amazon.com Inc.',        type: 'Stock', last_price: 224.80, weight_percent: 10 },
      ],
    },
    {
      id: 'demo-2',
      owner: userId,
      name: 'S&P 500 Core',
      description: 'Pure passive US large-cap index exposure',
      primary_benchmark: '^GSPC',
      secondary_benchmarks: [],
      created_at: now,
      last_updated_at: now,
      holdings: [
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'ETF', last_price: 596.41, weight_percent: 100 },
      ],
    },
    {
      id: 'demo-3',
      owner: userId,
      name: 'Global Balanced',
      description: 'Diversified across equities, bonds, and international',
      primary_benchmark: 'EFA',
      secondary_benchmarks: [],
      created_at: now,
      last_updated_at: now,
      holdings: [
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust',          type: 'ETF', last_price: 596.41, weight_percent: 40 },
        { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond', type: 'ETF', last_price: 97.20,  weight_percent: 40 },
        { ticker: 'IWM', name: 'iShares Russell 2000 ETF',         type: 'ETF', last_price: 228.15, weight_percent: 10 },
        { ticker: 'EFA', name: 'iShares MSCI EAFE ETF',            type: 'ETF', last_price: 78.44,  weight_percent: 10 },
      ],
    },
  ];
}
