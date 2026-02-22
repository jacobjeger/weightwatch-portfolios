import { format, subDays } from 'date-fns';

// ─── Instrument list ──────────────────────────────────────────────────────────
export const INSTRUMENTS = [
  // Benchmark ETFs
  { ticker: 'SPY',  name: 'SPDR S&P 500 ETF Trust',            type: 'ETF',   exchange: 'NYSE',   last_price: 596.41 },
  { ticker: 'QQQ',  name: 'Invesco QQQ Trust',                  type: 'ETF',   exchange: 'NASDAQ', last_price: 510.83 },
  { ticker: 'IWM',  name: 'iShares Russell 2000 ETF',           type: 'ETF',   exchange: 'NYSE',   last_price: 228.15 },
  { ticker: 'EFA',  name: 'iShares MSCI EAFE ETF',              type: 'ETF',   exchange: 'NYSE',   last_price: 78.44  },
  { ticker: 'ACWI', name: 'iShares MSCI ACWI ETF',              type: 'ETF',   exchange: 'NASDAQ', last_price: 110.62 },
  { ticker: 'AGG',  name: 'iShares Core U.S. Aggregate Bond',   type: 'ETF',   exchange: 'NYSE',   last_price: 97.20  },
  // Other ETFs
  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',               type: 'ETF',   exchange: 'NYSE',   last_price: 548.12 },
  { ticker: 'VTI',  name: 'Vanguard Total Stock Market ETF',    type: 'ETF',   exchange: 'NYSE',   last_price: 278.96 },
  { ticker: 'VGT',  name: 'Vanguard Information Technology ETF',type: 'ETF',   exchange: 'NYSE',   last_price: 587.34 },
  { ticker: 'VNQ',  name: 'Vanguard Real Estate ETF',           type: 'ETF',   exchange: 'NYSE',   last_price: 84.51  },
  { ticker: 'GLD',  name: 'SPDR Gold Shares',                   type: 'ETF',   exchange: 'NYSE',   last_price: 243.89 },
  { ticker: 'XLK',  name: 'Technology Select Sector SPDR',      type: 'ETF',   exchange: 'NYSE',   last_price: 228.43 },
  { ticker: 'XLF',  name: 'Financial Select Sector SPDR',       type: 'ETF',   exchange: 'NYSE',   last_price: 48.82  },
  { ticker: 'XLE',  name: 'Energy Select Sector SPDR',          type: 'ETF',   exchange: 'NYSE',   last_price: 92.17  },
  { ticker: 'XLV',  name: 'Health Care Select Sector SPDR',     type: 'ETF',   exchange: 'NYSE',   last_price: 138.95 },
  { ticker: 'ARKK', name: 'ARK Innovation ETF',                 type: 'ETF',   exchange: 'NYSE',   last_price: 52.34  },
  { ticker: 'TQQQ', name: 'ProShares UltraPro QQQ',             type: 'ETF',   exchange: 'NASDAQ', last_price: 68.14  },
  { ticker: 'BND',  name: 'Vanguard Total Bond Market ETF',     type: 'ETF',   exchange: 'NASDAQ', last_price: 73.88  },
  { ticker: 'TLT',  name: 'iShares 20+ Year Treasury Bond ETF', type: 'ETF',   exchange: 'NASDAQ', last_price: 91.27  },
  { ticker: 'LQD',  name: 'iShares iBoxx $ Investment Grade',   type: 'ETF',   exchange: 'NYSE',   last_price: 107.43 },
  // Large-cap Tech
  { ticker: 'AAPL', name: 'Apple Inc.',                         type: 'Stock', exchange: 'NASDAQ', last_price: 228.52 },
  { ticker: 'MSFT', name: 'Microsoft Corporation',              type: 'Stock', exchange: 'NASDAQ', last_price: 415.40 },
  { ticker: 'GOOGL',name: 'Alphabet Inc. Class A',              type: 'Stock', exchange: 'NASDAQ', last_price: 194.75 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.',                    type: 'Stock', exchange: 'NASDAQ', last_price: 224.80 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation',                 type: 'Stock', exchange: 'NASDAQ', last_price: 873.22 },
  { ticker: 'META', name: 'Meta Platforms Inc.',                type: 'Stock', exchange: 'NASDAQ', last_price: 589.70 },
  { ticker: 'TSLA', name: 'Tesla Inc.',                         type: 'Stock', exchange: 'NASDAQ', last_price: 354.45 },
  { ticker: 'ADBE', name: 'Adobe Inc.',                         type: 'Stock', exchange: 'NASDAQ', last_price: 524.83 },
  { ticker: 'CRM',  name: 'Salesforce Inc.',                    type: 'Stock', exchange: 'NYSE',   last_price: 303.14 },
  { ticker: 'NFLX', name: 'Netflix Inc.',                       type: 'Stock', exchange: 'NASDAQ', last_price: 760.94 },
  // Semiconductors
  { ticker: 'AMD',  name: 'Advanced Micro Devices Inc.',        type: 'Stock', exchange: 'NASDAQ', last_price: 178.83 },
  { ticker: 'INTC', name: 'Intel Corporation',                  type: 'Stock', exchange: 'NASDAQ', last_price: 24.38  },
  { ticker: 'QCOM', name: 'Qualcomm Inc.',                      type: 'Stock', exchange: 'NASDAQ', last_price: 186.40 },
  { ticker: 'AVGO', name: 'Broadcom Inc.',                      type: 'Stock', exchange: 'NASDAQ', last_price: 1743.60},
  { ticker: 'TXN',  name: 'Texas Instruments Inc.',             type: 'Stock', exchange: 'NASDAQ', last_price: 195.87 },
  { ticker: 'MU',   name: 'Micron Technology Inc.',             type: 'Stock', exchange: 'NASDAQ', last_price: 108.42 },
  // Financials
  { ticker: 'JPM',  name: 'JPMorgan Chase & Co.',               type: 'Stock', exchange: 'NYSE',   last_price: 244.78 },
  { ticker: 'BAC',  name: 'Bank of America Corporation',        type: 'Stock', exchange: 'NYSE',   last_price: 44.36  },
  { ticker: 'GS',   name: 'Goldman Sachs Group Inc.',           type: 'Stock', exchange: 'NYSE',   last_price: 584.20 },
  { ticker: 'MS',   name: 'Morgan Stanley',                     type: 'Stock', exchange: 'NYSE',   last_price: 128.55 },
  { ticker: 'WFC',  name: 'Wells Fargo & Company',              type: 'Stock', exchange: 'NYSE',   last_price: 76.34  },
  { ticker: 'V',    name: 'Visa Inc.',                          type: 'Stock', exchange: 'NYSE',   last_price: 314.92 },
  { ticker: 'MA',   name: 'Mastercard Incorporated',            type: 'Stock', exchange: 'NYSE',   last_price: 522.18 },
  // Consumer & Healthcare
  { ticker: 'AMGN', name: 'Amgen Inc.',                         type: 'Stock', exchange: 'NASDAQ', last_price: 268.79 },
  { ticker: 'JNJ',  name: 'Johnson & Johnson',                  type: 'Stock', exchange: 'NYSE',   last_price: 162.40 },
  { ticker: 'UNH',  name: 'UnitedHealth Group Incorporated',    type: 'Stock', exchange: 'NYSE',   last_price: 524.15 },
  { ticker: 'PG',   name: 'Procter & Gamble Co.',               type: 'Stock', exchange: 'NYSE',   last_price: 165.82 },
  { ticker: 'HD',   name: 'Home Depot Inc.',                    type: 'Stock', exchange: 'NYSE',   last_price: 407.26 },
  { ticker: 'DIS',  name: 'Walt Disney Company',                type: 'Stock', exchange: 'NYSE',   last_price: 114.27 },
  { ticker: 'COST', name: 'Costco Wholesale Corporation',       type: 'Stock', exchange: 'NASDAQ', last_price: 958.43 },
  // Energy
  { ticker: 'XOM',  name: 'Exxon Mobil Corporation',            type: 'Stock', exchange: 'NYSE',   last_price: 112.84 },
  { ticker: 'CVX',  name: 'Chevron Corporation',                type: 'Stock', exchange: 'NYSE',   last_price: 163.52 },
  // Industrials / Other
  { ticker: 'CAT',  name: 'Caterpillar Inc.',                   type: 'Stock', exchange: 'NYSE',   last_price: 390.47 },
  { ticker: 'BA',   name: 'Boeing Company',                     type: 'Stock', exchange: 'NYSE',   last_price: 170.38 },
  { ticker: 'BRK.B',name: 'Berkshire Hathaway Inc. Class B',   type: 'Stock', exchange: 'NYSE',   last_price: 450.91 },
  { ticker: 'PYPL', name: 'PayPal Holdings Inc.',               type: 'Stock', exchange: 'NASDAQ', last_price: 86.93  },
  { ticker: 'SNOW', name: 'Snowflake Inc.',                     type: 'Stock', exchange: 'NYSE',   last_price: 146.38 },
  { ticker: 'PLTR', name: 'Palantir Technologies Inc.',         type: 'Stock', exchange: 'NYSE',   last_price: 38.15  },
];

export const BENCHMARKS = ['SPY', 'QQQ', 'IWM', 'EFA', 'ACWI', 'AGG'];

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
  ETF: 0.007,
  Stock: 0.016,
};

const DRIFT = 0.00035; // slight upward drift per trading day

// Returns array of {date, price} from oldest to newest, ending near last_price.
export function generateHistory(ticker, numDays = 504) {
  const inst = INSTRUMENTS.find((i) => i.ticker === ticker);
  const currentPrice = inst?.last_price ?? 100;
  const vol = inst?.type === 'ETF' ? VOLATILITY.ETF : VOLATILITY.Stock;
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

export function getPortfolioChartData(holdings, benchmarkTicker, range = '1Y') {
  const numDays = RANGE_DAYS[range] ?? 252;

  if (!holdings || holdings.length === 0) {
    // Return flat benchmark-only chart
    if (!benchmarkTicker) return [];
    const bHist = generateHistory(benchmarkTicker, numDays);
    const b0 = bHist[0].price;
    return bHist.map((p) => ({
      date: p.date,
      benchmark: parseFloat(((p.price / b0) * 100).toFixed(2)),
    }));
  }

  // Per-holding histories
  const histories = holdings.map((h) => ({
    weight: h.weight_percent / 100,
    prices: generateHistory(h.ticker, numDays).map((p) => p.price),
  }));

  const benchHistory = benchmarkTicker
    ? generateHistory(benchmarkTicker, numDays).map((p) => p.price)
    : null;

  const dates = generateHistory(holdings[0].ticker, numDays).map((p) => p.date);

  return dates.map((date, i) => {
    const portfolioValue = histories.reduce((sum, h) => {
      const ret = h.prices[i] / h.prices[0];
      return sum + h.weight * ret * 100;
    }, 0);

    const entry = { date, portfolio: parseFloat(portfolioValue.toFixed(2)) };

    if (benchHistory) {
      entry.benchmark = parseFloat(((benchHistory[i] / benchHistory[0]) * 100).toFixed(2));
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
      primary_benchmark: 'QQQ',
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
      primary_benchmark: 'SPY',
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
      primary_benchmark: 'ACWI',
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

// ─── Benchmark display metadata ───────────────────────────────────────────────
export const BENCHMARK_META = {
  SPY:  { label: 'S&P 500',       color: '#3b82f6' },
  QQQ:  { label: 'Nasdaq-100',    color: '#8b5cf6' },
  IWM:  { label: 'Russell 2000',  color: '#f59e0b' },
  EFA:  { label: 'MSCI EAFE',     color: '#10b981' },
  ACWI: { label: 'MSCI ACWI',     color: '#06b6d4' },
  AGG:  { label: 'US Agg Bond',   color: '#6b7280' },
};
