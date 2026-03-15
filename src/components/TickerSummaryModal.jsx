import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Building2, DollarSign } from 'lucide-react';
import { INSTRUMENTS, BENCHMARK_META } from '../lib/mockData';
import { isConfigured, getQuote } from '../lib/finnhub';

// Brief descriptions for common tickers
const TICKER_DESCRIPTIONS = {
  // Broad market ETFs
  SPY: 'Tracks the S&P 500 index, providing exposure to 500 of the largest US companies. One of the most traded ETFs in the world.',
  QQQ: 'Tracks the NASDAQ-100 index, offering concentrated exposure to the largest non-financial companies listed on NASDAQ, heavily weighted toward technology.',
  IWM: 'Tracks the Russell 2000 index, providing broad exposure to US small-cap stocks with higher growth potential and volatility.',
  DIA: 'Tracks the Dow Jones Industrial Average, a price-weighted index of 30 prominent US blue-chip companies.',
  VOO: 'Vanguard\'s S&P 500 ETF with one of the lowest expense ratios available, providing broad US large-cap exposure.',
  VTI: 'Provides exposure to the entire US stock market including small-, mid-, and large-cap equities across all sectors.',
  // Bond ETFs
  AGG: 'Tracks the Bloomberg US Aggregate Bond Index, providing diversified exposure to investment-grade US bonds.',
  BND: 'Vanguard\'s total bond market ETF, covering the entire US investment-grade bond market at a very low cost.',
  TLT: 'Focuses on long-term US Treasury bonds (20+ years), offering high interest rate sensitivity and duration.',
  HYG: 'Provides exposure to US dollar-denominated high-yield (junk) corporate bonds with higher yields and credit risk.',
  // Sector ETFs
  XLK: 'Tracks the technology sector of the S&P 500, including major companies in software, hardware, and IT services.',
  XLF: 'Provides exposure to the financial sector of the S&P 500 including banks, insurance companies, and REITs.',
  XLE: 'Tracks the energy sector of the S&P 500, including major oil, gas, and energy equipment companies.',
  XLV: 'Covers the healthcare sector of the S&P 500 including pharmaceuticals, biotechnology, and medical devices.',
  // Thematic ETFs
  ARKK: 'Actively managed ETF focused on disruptive innovation across genomics, AI, fintech, and autonomous technology.',
  SOXX: 'Provides targeted exposure to US-listed semiconductor companies, a key sector in the technology supply chain.',
  GLD: 'Physically backed gold ETF that tracks the price of gold bullion, commonly used as an inflation hedge.',
  IBIT: 'BlackRock\'s spot Bitcoin ETF providing direct exposure to Bitcoin through a regulated investment vehicle.',
  // Tech stocks
  AAPL: 'The world\'s largest company by market cap, known for iPhone, Mac, iPad, and services ecosystem. Strong brand loyalty and recurring revenue.',
  MSFT: 'Leading enterprise software and cloud computing company. Azure, Office 365, and AI investments through OpenAI partnership drive growth.',
  GOOGL: 'Parent company Alphabet dominates search and digital advertising. Growing cloud platform (GCP) and AI capabilities.',
  AMZN: 'E-commerce leader and dominant cloud provider through AWS. Expanding into AI, advertising, and healthcare.',
  NVDA: 'Leading designer of GPUs critical for AI training and inference. Dominant market share in data center AI accelerators.',
  META: 'Social media giant operating Facebook, Instagram, and WhatsApp. Investing heavily in AI and metaverse technologies.',
  TSLA: 'Electric vehicle manufacturer and energy company. Pioneer in EV adoption with expanding global manufacturing capacity.',
  // Finance
  JPM: 'The largest US bank by assets, with leading positions in investment banking, commercial banking, and asset management.',
  V: 'The world\'s largest payment technology company, processing billions of transactions annually across 200+ countries.',
  // Healthcare
  JNJ: 'Diversified healthcare conglomerate spanning pharmaceuticals, medical devices, and consumer health products.',
  UNH: 'Largest US health insurer and healthcare services company through UnitedHealthcare and Optum divisions.',
  LLY: 'Major pharmaceutical company with blockbuster drugs in diabetes (Mounjaro), obesity (Zepbound), and oncology.',
  // Other notable
  BRK: 'Warren Buffett\'s conglomerate holding company with diverse investments across insurance, energy, rail, and equities.',
  COST: 'Membership-based warehouse retailer known for bulk goods, strong customer loyalty, and consistent growth.',
  HD: 'Largest US home improvement retailer serving both DIY consumers and professional contractors.',
};

export default function TickerSummaryModal({ ticker, onClose }) {
  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(false);

  const instrument = INSTRUMENTS.find((i) => i.ticker === ticker);
  const benchMeta = BENCHMARK_META[ticker];

  // Fetch real-time quote if Finnhub is configured
  useEffect(() => {
    if (!isConfigured() || !ticker) return;
    let cancelled = false;
    setLoading(true);
    getQuote(ticker)
      .then((data) => { if (!cancelled) setQuoteData(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (!ticker) return null;

  const name = instrument?.name ?? benchMeta?.label ?? ticker;
  const type = instrument?.type ?? 'Stock';
  const exchange = instrument?.exchange ?? '';
  const price = quoteData?.price ?? instrument?.last_price ?? null;
  const change = quoteData?.change ?? null;
  const changePercent = quoteData?.changePercent ?? null;
  const high = quoteData?.high ?? null;
  const low = quoteData?.low ?? null;
  const open = quoteData?.open ?? null;
  const expenseRatio = instrument?.expense_ratio ?? null;
  const divYield = instrument?.div_yield ?? null;
  const description = TICKER_DESCRIPTIONS[ticker] ?? benchMeta?.description ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{ticker}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                type === 'ETF' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
              }`}>
                {type}
              </span>
              {exchange && (
                <span className="text-xs text-slate-400">{exchange}</span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Price info */}
        <div className="px-5 py-4">
          {price != null && (
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-2xl font-bold text-slate-900">
                ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {changePercent != null && (
                <span className={`flex items-center gap-1 text-sm font-semibold ${
                  changePercent > 0 ? 'text-green-600' : changePercent < 0 ? 'text-red-500' : 'text-slate-500'
                }`}>
                  {changePercent > 0 ? <TrendingUp className="w-4 h-4" /> : changePercent < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                  {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
                  {change != null && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({change > 0 ? '+' : ''}${change.toFixed(2)})
                    </span>
                  )}
                </span>
              )}
              {loading && <span className="text-xs text-slate-400 animate-pulse">Loading...</span>}
            </div>
          )}

          {/* Day range */}
          {(high != null || low != null || open != null) && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {open != null && (
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Open</p>
                  <p className="text-sm font-semibold text-slate-700">${open.toFixed(2)}</p>
                </div>
              )}
              {high != null && (
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-green-500 uppercase font-medium">High</p>
                  <p className="text-sm font-semibold text-green-700">${high.toFixed(2)}</p>
                </div>
              )}
              {low != null && (
                <div className="bg-red-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-red-400 uppercase font-medium">Low</p>
                  <p className="text-sm font-semibold text-red-600">${low.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {/* Key metrics */}
          {(expenseRatio != null || divYield != null) && (
            <div className="flex gap-4 mb-4">
              {expenseRatio != null && expenseRatio > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Expense Ratio:</span>
                  <span className="font-semibold text-slate-700">{expenseRatio.toFixed(2)}%</span>
                </div>
              )}
              {divYield != null && divYield > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Div Yield:</span>
                  <span className="font-semibold text-slate-700">{divYield.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="bg-slate-50 rounded-lg p-3 mt-2">
              <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
            </div>
          )}
          {!description && (
            <div className="bg-slate-50 rounded-lg p-3 mt-2">
              <p className="text-sm text-slate-400 italic">No description available for this ticker.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
