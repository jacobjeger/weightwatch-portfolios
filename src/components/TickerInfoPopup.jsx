import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { INSTRUMENTS, BENCHMARK_META } from '../lib/mockData';
import { isConfigured, getQuote } from '../lib/finnhub';

const useLive = isConfigured();

// Brief descriptions for common tickers — covers ETFs and major stocks
const TICKER_DESCRIPTIONS = {
  // Broad market ETFs
  SPY:  'Tracks the S&P 500 index of 500 large-cap US companies. The most widely traded ETF in the world.',
  QQQ:  'Tracks the NASDAQ-100 index, heavily weighted toward large-cap tech companies like Apple, Microsoft, and NVIDIA.',
  IWM:  'Tracks the Russell 2000 index of US small-cap companies, offering exposure to smaller, growth-oriented businesses.',
  DIA:  'Tracks the Dow Jones Industrial Average of 30 blue-chip US stocks across various industries.',
  VOO:  'Vanguard\'s S&P 500 ETF with one of the lowest expense ratios available. Tracks the same index as SPY.',
  VTI:  'Provides exposure to the entire US stock market — large, mid, small, and micro-cap stocks.',
  VGT:  'Covers the US information technology sector including software, hardware, and semiconductor companies.',
  VNQ:  'Invests in real estate investment trusts (REITs) and other real estate companies.',
  EFA:  'Tracks developed international markets outside the US and Canada — Europe, Australasia, and Far East.',
  EEM:  'Provides exposure to emerging market equities including China, India, Brazil, and others.',
  ACWI: 'Tracks both developed and emerging market equities worldwide — a single-fund global equity solution.',
  VXUS: 'Covers the entire international stock market outside the US, including both developed and emerging markets.',
  // Bond ETFs
  AGG:  'Tracks the US investment-grade bond market — government, corporate, and mortgage-backed securities.',
  BND:  'Vanguard\'s total US bond market ETF, similar to AGG with a very low expense ratio.',
  TLT:  'Tracks long-term (20+ year) US Treasury bonds. Highly sensitive to interest rate changes.',
  HYG:  'Invests in high-yield (junk) corporate bonds. Higher income potential with greater credit risk.',
  LQD:  'Tracks investment-grade US corporate bonds. Middle ground between Treasuries and high-yield.',
  TIPS: 'Invests in Treasury Inflation-Protected Securities, which adjust principal for inflation.',
  // Sector ETFs
  XLK:  'Technology sector ETF covering software, IT services, hardware, and semiconductor companies.',
  XLF:  'Financial sector ETF including banks, insurance companies, and financial services firms.',
  XLE:  'Energy sector ETF covering oil & gas exploration, production, refining, and services.',
  XLV:  'Healthcare sector ETF including pharma, biotech, medical devices, and managed care.',
  XLI:  'Industrial sector ETF covering aerospace, defense, machinery, and transportation.',
  XLY:  'Consumer discretionary ETF covering retail, automotive, media, and consumer services.',
  XLRE: 'Real estate sector ETF focused on REITs and real estate management companies.',
  XLU:  'Utilities sector ETF covering electric, gas, water, and renewable energy companies.',
  // Thematic / specialty ETFs
  ARKK: 'Actively managed ETF focused on disruptive innovation — genomics, AI, fintech, energy storage.',
  TQQQ: '3x leveraged daily return of the NASDAQ-100. Designed for short-term trading, not long-term holding.',
  SQQQ: '3x inverse leveraged NASDAQ-100. Profits when NASDAQ falls. High risk, short-term instrument.',
  SOXX: 'Tracks US semiconductor companies — AMD, Intel, NVIDIA, Broadcom, and others.',
  GLD:  'Holds physical gold bullion. Tracks the spot price of gold as a store of value and inflation hedge.',
  SLV:  'Holds physical silver bullion. Tracks the spot price of silver.',
  SCHD: 'High-dividend US equity ETF selecting companies with strong dividend track records.',
  JEPI: 'JPMorgan equity premium income ETF using covered calls for high monthly income.',
  JEPQ: 'JPMorgan NASDAQ equity premium income ETF with covered call strategy for high yield.',
  VIG:  'Tracks US companies with a history of increasing dividends for 10+ consecutive years.',
  SPLG: 'Ultra low-cost S&P 500 ETF from State Street. Identical exposure to SPY at a fraction of the cost.',
  QQQM: 'Lower-cost NASDAQ-100 ETF from Invesco. Same holdings as QQQ with a lower expense ratio.',
  AVUV: 'Actively managed small-cap value ETF targeting undervalued US small companies.',
  GLTR: 'Holds a basket of physical precious metals — gold, silver, platinum, and palladium.',
  BITW: 'Tracks a diversified index of the top 10 cryptocurrencies by market cap.',
  IBIT: 'iShares spot Bitcoin ETF providing direct exposure to Bitcoin without holding crypto directly.',
  VWO:  'Vanguard emerging markets ETF covering China, India, Brazil, Taiwan, and other developing economies.',
  // Mega-cap stocks
  AAPL: 'Consumer electronics and services giant. Makes iPhone, Mac, iPad, and runs App Store and Apple Music.',
  MSFT: 'Enterprise software and cloud leader. Runs Azure cloud, Office 365, Windows, LinkedIn, and GitHub.',
  GOOGL:'Parent of Google. Dominates search, online advertising, YouTube, and Android mobile operating system.',
  GOOG: 'Alphabet Class C shares (no voting rights). Same business as GOOGL.',
  AMZN: 'E-commerce and cloud computing giant. Runs AWS (leading cloud platform), Prime, and Whole Foods.',
  NVDA: 'Leading GPU and AI chip designer. Powers AI training, data centers, gaming, and autonomous vehicles.',
  META: 'Social media company behind Facebook, Instagram, WhatsApp, and Threads. Investing heavily in VR/AR.',
  TSLA: 'Electric vehicle manufacturer and clean energy company. Also makes solar panels and battery storage.',
  BRK:  'Warren Buffett\'s holding company. Owns GEICO, BNSF Railway, Dairy Queen, and major stock portfolio.',
  JPM:  'Largest US bank by assets. Full-service financial institution — banking, investing, and asset management.',
  V:    'Global payments network processing credit and debit card transactions for banks worldwide.',
  JNJ:  'Diversified healthcare company — pharmaceuticals, medical devices, and consumer health products.',
  WMT:  'World\'s largest retailer operating hypermarkets, grocery stores, and a growing e-commerce platform.',
  MA:   'Global payments network, second to Visa. Processes card transactions for banks and merchants.',
  PG:   'Consumer goods giant behind brands like Tide, Pampers, Gillette, and Charmin.',
  HD:   'Largest US home improvement retailer. Sells tools, building materials, and home décor.',
  UNH:  'Largest US health insurer. Runs UnitedHealthcare and Optum health services division.',
  COST: 'Membership warehouse retailer known for bulk buying, low prices, and the famous $1.50 hot dog combo.',
  DIS:  'Global entertainment conglomerate — Disney parks, Marvel, Star Wars, Pixar, ESPN, and Disney+.',
  NFLX: 'World\'s leading streaming entertainment service with 280M+ subscribers globally.',
  AMD:  'Semiconductor company making CPUs and GPUs for PCs, servers, and game consoles. NVIDIA\'s main competitor.',
  CRM:  'Cloud-based CRM software leader. Helps businesses manage customer relationships and sales pipelines.',
  INTC: 'Legacy chip maker producing CPUs for PCs and servers. Investing heavily in US chip manufacturing.',
  CSCO: 'Networking equipment giant making routers, switches, and cybersecurity products for enterprises.',
  PEP:  'Beverage and snack company behind Pepsi, Lay\'s, Gatorade, Quaker Oats, and Frito-Lay.',
  KO:   'World\'s largest beverage company. Makes Coca-Cola, Sprite, Fanta, and Dasani water.',
  ABBV: 'Biopharmaceutical company known for Humira, Botox, and specialty medicines.',
  LLY:  'Pharmaceutical company behind Mounjaro/Zepbound (weight loss) and major diabetes treatments.',
  MRK:  'Global pharma company known for Keytruda (cancer immunotherapy) and veterinary products.',
  AVGO: 'Semiconductor company specializing in chips for data centers, networking, and broadband.',
  ORCL: 'Enterprise software and cloud infrastructure company. Runs Oracle Cloud and database products.',
  TMO:  'Life sciences company providing analytical instruments, lab equipment, and diagnostics.',
  ADBE: 'Creative and document software company behind Photoshop, Illustrator, Acrobat, and Adobe Experience Cloud.',
  PYPL: 'Digital payments company operating PayPal and Venmo platforms for online and mobile payments.',
  UBER: 'Ride-hailing and food delivery platform operating in 70+ countries.',
};

export default function TickerInfoPopup({ ticker, holding, livePrice, onClose }) {
  const [quote, setQuote] = useState(null);

  // Look up static info
  const instrument = INSTRUMENTS.find((i) => i.ticker === ticker);
  const benchInfo = BENCHMARK_META[ticker];
  const description = TICKER_DESCRIPTIONS[ticker] || benchInfo?.description || null;

  // Fetch live quote if available
  useEffect(() => {
    if (!useLive || !ticker) return;
    let cancelled = false;
    getQuote(ticker).then((q) => { if (!cancelled && q) setQuote(q); }).catch(() => {});
    return () => { cancelled = true; };
  }, [ticker]);

  const price = livePrice || quote?.c || instrument?.last_price || holding?.last_price;
  const change = quote?.dp ?? null; // daily change percent
  const name = holding?.name || instrument?.name || ticker;
  const type = holding?.type || instrument?.type || 'Stock';
  const exchange = instrument?.exchange || '';
  const expenseRatio = instrument?.expense_ratio ?? holding?.expense_ratio ?? null;
  const divYield = instrument?.div_yield ?? holding?.div_yield ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{ticker}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              type === 'ETF' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>{type}</span>
            {exchange && <span className="text-xs text-slate-400">{exchange}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">{name}</p>

          {description && (
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          )}

          {/* Price & change */}
          {price != null && (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-slate-900">
                ${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {change != null && (
                <span className={`flex items-center gap-0.5 text-sm font-medium ${
                  change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-500' : 'text-slate-400'
                }`}>
                  {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  {change > 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
              )}
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            {holding?.weight_percent != null && (
              <div>
                <p className="text-xs text-slate-400">Target Weight</p>
                <p className="text-sm font-semibold text-slate-700">{Number(holding.weight_percent).toFixed(1)}%</p>
              </div>
            )}
            {holding?.category && (
              <div>
                <p className="text-xs text-slate-400">Role</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  holding.category === 'Core' ? 'bg-blue-50 text-blue-700'
                    : holding.category === 'Tilt' ? 'bg-violet-50 text-violet-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>{holding.category}</span>
              </div>
            )}
            {expenseRatio != null && expenseRatio > 0 && (
              <div>
                <p className="text-xs text-slate-400">Expense Ratio</p>
                <p className="text-sm font-semibold text-slate-700">{(expenseRatio * 100).toFixed(2) + '%' || expenseRatio + '%'}</p>
              </div>
            )}
            {divYield != null && divYield > 0 && (
              <div>
                <p className="text-xs text-slate-400">Dividend Yield</p>
                <p className="text-sm font-semibold text-slate-700">{Number(divYield).toFixed(1)}%</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
