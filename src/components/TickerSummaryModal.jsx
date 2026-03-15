import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Building2, DollarSign } from 'lucide-react';
import { INSTRUMENTS, BENCHMARK_META } from '../lib/mockData';
import { isConfigured, getQuote } from '../lib/finnhub';

// Brief descriptions for all supported tickers
const TICKER_DESCRIPTIONS = {
  // ── Broad Market ETFs ──
  SPY: 'Tracks the S&P 500 index, providing exposure to 500 of the largest US companies. One of the most traded ETFs in the world.',
  QQQ: 'Tracks the NASDAQ-100 index, offering concentrated exposure to the largest non-financial companies listed on NASDAQ, heavily weighted toward technology.',
  IWM: 'Tracks the Russell 2000 index, providing broad exposure to US small-cap stocks with higher growth potential and volatility.',
  DIA: 'Tracks the Dow Jones Industrial Average, a price-weighted index of 30 prominent US blue-chip companies.',
  EFA: 'Tracks developed international markets outside the US and Canada, covering Europe, Australasia, and the Far East.',
  ACWI: 'Provides exposure to both developed and emerging market equities worldwide in a single fund.',
  EEM: 'Tracks the MSCI Emerging Markets Index, offering exposure to large and mid-cap companies in developing economies.',
  VOO: 'Vanguard\'s S&P 500 ETF with one of the lowest expense ratios available, providing broad US large-cap exposure.',
  VTI: 'Provides exposure to the entire US stock market including small-, mid-, and large-cap equities across all sectors.',
  VXUS: 'Vanguard\'s total international stock ETF covering developed and emerging markets outside the US.',
  QQQM: 'Lower-cost version of QQQ tracking the NASDAQ-100, designed for buy-and-hold investors with a smaller expense ratio.',
  SPLG: 'SPDR\'s lowest-cost S&P 500 ETF, providing broad US large-cap exposure at a minimal expense ratio.',
  VIG: 'Tracks US companies with a history of increasing dividends over 10+ consecutive years, emphasizing dividend growth.',

  // ── Bond ETFs ──
  AGG: 'Tracks the Bloomberg US Aggregate Bond Index, providing diversified exposure to investment-grade US bonds.',
  BND: 'Vanguard\'s total bond market ETF, covering the entire US investment-grade bond market at a very low cost.',
  TLT: 'Focuses on long-term US Treasury bonds (20+ years), offering high interest rate sensitivity and duration.',
  HYG: 'Provides exposure to US dollar-denominated high-yield (junk) corporate bonds with higher yields and credit risk.',
  LQD: 'Tracks the investment-grade corporate bond market, offering exposure to bonds from financially stable US companies.',
  TIPS: 'Invests in US Treasury Inflation-Protected Securities, providing a hedge against rising inflation.',

  // ── Sector ETFs ──
  XLK: 'Tracks the technology sector of the S&P 500, including major companies in software, hardware, and IT services.',
  XLF: 'Provides exposure to the financial sector of the S&P 500 including banks, insurance companies, and REITs.',
  XLE: 'Tracks the energy sector of the S&P 500, including major oil, gas, and energy equipment companies.',
  XLV: 'Covers the healthcare sector of the S&P 500 including pharmaceuticals, biotechnology, and medical devices.',
  XLI: 'Tracks the industrial sector of the S&P 500 including aerospace, defense, machinery, and transportation companies.',
  XLY: 'Covers the consumer discretionary sector including retail, automotive, leisure, and media companies.',
  XLRE: 'Provides exposure to US real estate investment trusts (REITs) and real estate management companies.',
  XLU: 'Tracks the utilities sector of the S&P 500, offering stable dividends from electric, gas, and water companies.',
  VGT: 'Vanguard\'s broad technology ETF covering IT services, software, semiconductors, and tech hardware.',
  VNQ: 'Vanguard\'s real estate ETF tracking US REITs, offering diversified exposure to commercial and residential properties.',
  VWO: 'Vanguard\'s emerging markets ETF providing low-cost exposure to developing economies worldwide.',

  // ── Thematic & Specialty ETFs ──
  ARKK: 'Actively managed ETF focused on disruptive innovation across genomics, AI, fintech, and autonomous technology.',
  SOXX: 'Provides targeted exposure to US-listed semiconductor companies, a key sector in the technology supply chain.',
  GLD: 'Physically backed gold ETF that tracks the price of gold bullion, commonly used as an inflation hedge.',
  SLV: 'Physically backed silver ETF tracking the price of silver bullion, used for precious metals exposure and inflation hedging.',
  IBIT: 'BlackRock\'s spot Bitcoin ETF providing direct exposure to Bitcoin through a regulated investment vehicle.',
  BITW: 'Tracks the Bitwise 10 Large Cap Crypto Index, offering diversified exposure to the top cryptocurrencies by market cap.',
  GLTR: 'Holds physical gold, silver, platinum, and palladium, providing diversified precious metals exposure in a single fund.',
  TQQQ: 'Leveraged ETF providing 3x daily returns of the NASDAQ-100. Designed for short-term trading, not long-term holding.',
  SQQQ: 'Inverse leveraged ETF providing 3x inverse daily returns of the NASDAQ-100. Used for hedging or short-term bearish bets.',
  AVUV: 'Actively managed small-cap value ETF using Avantis\'s factor-based approach to target higher expected returns.',
  SCHD: 'Tracks high-dividend-yield US stocks screened for financial strength, offering quality income with low fees.',
  JEPI: 'Generates income through a combination of S&P 500 stocks and equity-linked notes using a covered call strategy.',
  JEPQ: 'Income-focused ETF using NASDAQ-100 stocks and options overlay to generate enhanced yield from tech-heavy holdings.',

  // ── Tech Stocks ──
  AAPL: 'The world\'s largest company by market cap, known for iPhone, Mac, iPad, and services ecosystem. Strong brand loyalty and recurring revenue.',
  MSFT: 'Leading enterprise software and cloud computing company. Azure, Office 365, and AI investments through OpenAI partnership drive growth.',
  GOOGL: 'Parent company Alphabet dominates search and digital advertising. Growing cloud platform (GCP) and AI capabilities.',
  GOOG: 'Alphabet Class C shares (no voting rights). Same company as GOOGL, offering exposure to Google\'s search, cloud, and AI businesses.',
  AMZN: 'E-commerce leader and dominant cloud provider through AWS. Expanding into AI, advertising, and healthcare.',
  NVDA: 'Leading designer of GPUs critical for AI training and inference. Dominant market share in data center AI accelerators.',
  META: 'Social media giant operating Facebook, Instagram, and WhatsApp. Investing heavily in AI and metaverse technologies.',
  TSLA: 'Electric vehicle manufacturer and energy company. Pioneer in EV adoption with expanding global manufacturing capacity.',
  ADBE: 'Dominant creative and document software company behind Photoshop, Illustrator, and Acrobat. Strong recurring subscription revenue.',
  CRM: 'Leading cloud-based CRM platform powering sales, service, and marketing automation for enterprises worldwide.',
  NFLX: 'Global streaming entertainment leader with 200M+ subscribers. Original content production drives subscriber growth.',
  ORCL: 'Enterprise database and cloud infrastructure company. Growing cloud business competing with AWS and Azure.',
  NOW: 'Enterprise cloud platform for digital workflow automation. High growth SaaS company with strong retention rates.',
  SHOP: 'E-commerce platform enabling merchants of all sizes to sell online, in-store, and across social media channels.',
  UBER: 'Global ride-hailing and food delivery platform operating in 70+ countries with expanding freight and advertising businesses.',
  SPOT: 'World\'s largest audio streaming platform with 600M+ users. Growing podcast and advertising revenue diversifies beyond music.',
  APP: 'Mobile app technology company providing marketing and monetization tools for app developers, powered by AI-driven advertising.',

  // ── Semiconductors ──
  AMD: 'Designs CPUs and GPUs competing with Intel and NVIDIA. Growing data center market share with EPYC and Instinct processors.',
  INTC: 'Largest US chipmaker by revenue, manufacturing CPUs for PCs and servers. Investing heavily in domestic semiconductor fabrication.',
  QCOM: 'Leading designer of mobile processors and 5G modems powering most Android smartphones. Expanding into automotive and IoT.',
  AVGO: 'Diversified semiconductor company with leading positions in networking, broadband, and custom AI accelerators.',
  TXN: 'Largest analog semiconductor company globally, serving industrial and automotive markets with stable, high-margin products.',
  MU: 'Major manufacturer of DRAM and NAND memory chips used in data centers, PCs, and mobile devices.',
  AMAT: 'Largest semiconductor equipment maker, providing the machines used to manufacture chips at leading foundries.',
  LRCX: 'Semiconductor equipment company specializing in etch and deposition tools critical to advanced chip manufacturing.',
  KLAC: 'Leading provider of process control and yield management systems for the semiconductor industry.',
  ARM: 'Designs the CPU architecture used in virtually all smartphones and an expanding share of cloud servers and PCs.',

  // ── Finance ──
  JPM: 'The largest US bank by assets, with leading positions in investment banking, commercial banking, and asset management.',
  BAC: 'Second-largest US bank serving consumers, businesses, and institutions. Major mortgage lender and wealth manager.',
  GS: 'Premier global investment bank and financial services firm known for M&A advisory, trading, and asset management.',
  MS: 'Major investment bank and wealth management firm. Morgan Stanley Wealth Management is one of the largest US advisory platforms.',
  WFC: 'One of the largest US banks by assets, with a dominant position in mortgage lending and consumer banking.',
  V: 'The world\'s largest payment technology company, processing billions of transactions annually across 200+ countries.',
  MA: 'Second-largest global payment network, processing transactions in 210+ countries with strong cross-border payment capabilities.',
  AXP: 'Premium credit card issuer and payment network known for affluent cardholder base and travel rewards programs.',
  BLK: 'World\'s largest asset manager with $10T+ in AUM, operator of the iShares ETF platform.',
  SCHW: 'Leading discount brokerage and wealth management firm serving individual investors and registered investment advisors.',
  COF: 'Major consumer banking and credit card company known for data-driven lending and the Capital One credit card brand.',

  // ── Healthcare ──
  JNJ: 'Diversified healthcare conglomerate spanning pharmaceuticals, medical devices, and consumer health products.',
  UNH: 'Largest US health insurer and healthcare services company through UnitedHealthcare and Optum divisions.',
  LLY: 'Major pharmaceutical company with blockbuster drugs in diabetes (Mounjaro), obesity (Zepbound), and oncology.',
  AMGN: 'Pioneer in biotechnology developing therapies for serious illnesses including cancer, cardiovascular disease, and osteoporosis.',
  PFE: 'Global pharmaceutical giant known for vaccines, oncology treatments, and COVID-19 vaccine. One of the world\'s largest drugmakers.',
  ABBV: 'Biopharmaceutical company known for Humira (immunology) and expanding portfolio in oncology and neuroscience.',
  MRK: 'Global pharmaceutical company with leading positions in oncology (Keytruda), vaccines, and animal health.',
  GILD: 'Biopharmaceutical company leading in antiviral therapies including HIV and hepatitis treatments.',
  ISRG: 'Maker of the da Vinci robotic surgical system, the dominant platform for minimally invasive surgery worldwide.',

  // ── Consumer & Retail ──
  BRK: 'Warren Buffett\'s conglomerate holding company with diverse investments across insurance, energy, rail, and equities.',
  COST: 'Membership-based warehouse retailer known for bulk goods, strong customer loyalty, and consistent growth.',
  HD: 'Largest US home improvement retailer serving both DIY consumers and professional contractors.',
  PG: 'World\'s largest consumer goods company with brands including Tide, Pampers, Gillette, and Crest.',
  DIS: 'Global entertainment conglomerate operating theme parks, Disney+, ESPN, and major film studios including Pixar and Marvel.',
  WMT: 'World\'s largest retailer by revenue, operating hypermarkets, discount stores, and a growing e-commerce business.',
  TGT: 'Mass-market retailer known for affordable style, strong private-label brands, and same-day delivery services.',
  MCD: 'World\'s largest fast-food chain by revenue, operating 40,000+ restaurants across 100+ countries.',
  SBUX: 'Global coffeehouse chain with 35,000+ stores. Premium brand with strong loyalty program and digital ordering.',
  NKE: 'World\'s largest athletic footwear and apparel company, known for innovation in sportswear and powerful brand marketing.',
  KO: 'World\'s largest beverage company, producing Coca-Cola, Sprite, Fanta, and 200+ other brands sold in 200+ countries.',
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
