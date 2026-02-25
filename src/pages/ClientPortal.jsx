import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, MessageCircle, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { useAuth, getPortfolios, getMessages, getLatestApproval } from '../context/AuthContext';
import { BENCHMARK_META, getPortfolioReturn, getPortfolioYTDReturn, getReturn, getYTDReturn, getPortfolioSinceReturn } from '../lib/mockData';
import { getRealPerformanceReturns } from '../lib/finnhub';
import { useMarketData } from '../context/MarketDataContext';
import PerformanceChart from '../components/PerformanceChart';
import HoldingsPerformanceChart from '../components/HoldingsPerformanceChart';
import AllocationPieChart from '../components/AllocationPieChart';
import MessagePanel from '../components/MessagePanel';

export default function ClientPortal() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { live, prices, loadTickers, subscribeTickers } = useMarketData();
  const [realReturns, setRealReturns] = useState(null);

  useEffect(() => {
    if (user) {
      const all = getPortfolios(user.id);
      setPortfolios(all);
    }
  }, [user]);

  const portfolio = portfolios[selectedIdx] || null;
  const approval = portfolio ? getLatestApproval(portfolio.id) : null;
  const holdings = portfolio?.holdings ?? [];
  const benchmark = portfolio?.primary_benchmark;

  // Load + subscribe real-time prices
  useEffect(() => {
    if (!live || !portfolio) return;
    const tickers = holdings.map((h) => h.ticker);
    if (benchmark) tickers.push(benchmark);
    if (!tickers.length) return;
    loadTickers(tickers);
    const unsub = subscribeTickers(tickers);
    return unsub;
  }, [live, holdings, benchmark, loadTickers, subscribeTickers, portfolio]);

  // Fetch real candle-based returns
  useEffect(() => {
    if (!live || !holdings.length) return;
    let cancelled = false;
    getRealPerformanceReturns(holdings, benchmark || null).then((data) => {
      if (!cancelled && data) setRealReturns(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [live, holdings, benchmark]);

  if (!user || role !== 'client') {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Client Portal</h1>
        <p className="text-slate-500">This portal is available for invited clients. Please use an invite link from your advisor.</p>
      </div>
    );
  }

  if (!portfolios.length) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Client Portal</h1>
        <p className="text-slate-500 mb-4">No portfolios have been shared with you yet.</p>
        <p className="text-sm text-slate-400">Ask your advisor for an invite link to get started.</p>
      </div>
    );
  }

  const benchLabel = benchmark ? (BENCHMARK_META[benchmark]?.label ?? benchmark) : null;

  // Compute performance metrics — prefer real data, fall back to mock
  const ytdReturn = realReturns?.portfolio?.['YTD'] != null
    ? realReturns.portfolio['YTD']
    : (holdings.length ? parseFloat(getPortfolioYTDReturn(holdings)) : null);
  const sinceReturn = portfolio?.created_at && holdings.length ? parseFloat(getPortfolioSinceReturn(holdings, portfolio.created_at)) : null;
  const oneYearReturn = realReturns?.portfolio?.['1Y'] != null
    ? realReturns.portfolio['1Y']
    : (holdings.length ? parseFloat(getPortfolioReturn(holdings, 252)) : null);
  const benchYtd = realReturns?.benchmark?.['YTD'] != null
    ? realReturns.benchmark['YTD']
    : (benchmark ? parseFloat(getYTDReturn(benchmark)) : null);

  // Drifted weights using live prices (same logic as PortfolioBuilder)
  const currentWeights = useMemo(() => {
    if (!holdings.length) return {};
    const rows = holdings.map((h) => {
      const currentPrice = (live && prices[h.ticker]?.price) || h.last_price;
      const entryPrice = h.entry_price ?? h.last_price;
      const ratio = (entryPrice && entryPrice > 0) ? currentPrice / entryPrice : 1;
      return { ticker: h.ticker, targetWeight: h.weight_percent, ratio };
    });
    const denom = rows.reduce((s, r) => s + (r.targetWeight / 100) * r.ratio, 0);
    if (!denom) return {};
    return Object.fromEntries(rows.map((r) => [r.ticker, {
      driftedWeight: parseFloat(((r.targetWeight / 100) * r.ratio / denom * 100).toFixed(2)),
      ratio: r.ratio,
    }]));
  }, [holdings, prices, live]);

  const cashPercent = portfolio?.cash_percent ?? 0;
  const currentPortfolioValue = useMemo(() => {
    const sv = portfolio?.starting_value ?? 0;
    if (!holdings.length || !sv) return sv;
    const investedFrac = 1 - cashPercent / 100;
    const growthFactor = holdings.reduce(
      (s, h) => s + (h.weight_percent / 100) * (currentWeights[h.ticker]?.ratio ?? 1), 0
    );
    return sv * (growthFactor * investedFrac + cashPercent / 100);
  }, [holdings, currentWeights, portfolio, cashPercent]);

  const totalWeight = holdings.reduce((s, h) => s + (h.weight_percent || 0), 0);
  const isFullyAllocated = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Branded header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                  Client Portal
                </span>
                {approval && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    approval.type === 'approval'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {approval.type === 'approval' ? (
                      <><CheckCircle className="w-3 h-3" /> Approved</>
                    ) : (
                      <><AlertTriangle className="w-3 h-3" /> Changes Requested</>
                    )}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{portfolio?.name || 'Portfolio'}</h1>
              {portfolio?.description && (
                <p className="text-sm text-slate-500 mt-0.5">{portfolio.description}</p>
              )}
            </div>
            <div className="text-right text-sm text-slate-500 hidden sm:block">
              <p className="font-medium text-slate-700">{user.email}</p>
              {portfolio?.created_at && (
                <p className="text-xs text-slate-400">Portfolio since {new Date(portfolio.created_at).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Portfolio selector if multiple */}
          {portfolios.length > 1 && (
            <div className="flex gap-2 mt-4">
              {portfolios.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedIdx(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedIdx === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Performance summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Year-to-Date</p>
            <p className={`text-lg sm:text-xl font-bold ${ytdReturn > 0 ? 'text-green-600' : ytdReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {ytdReturn != null ? `${ytdReturn > 0 ? '+' : ''}${ytdReturn.toFixed(2)}%` : '--'}
            </p>
            {benchYtd != null && (
              <p className="text-xs text-slate-400 mt-1">
                {benchLabel}: {benchYtd > 0 ? '+' : ''}{benchYtd.toFixed(2)}%
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4">
            <p className="text-xs font-medium text-purple-600 mb-1">Since Creation</p>
            <p className={`text-lg sm:text-xl font-bold ${sinceReturn > 0 ? 'text-green-600' : sinceReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {sinceReturn != null ? `${sinceReturn > 0 ? '+' : ''}${sinceReturn.toFixed(2)}%` : '--'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">1-Year Return</p>
            <p className={`text-lg sm:text-xl font-bold ${oneYearReturn > 0 ? 'text-green-600' : oneYearReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {oneYearReturn != null ? `${oneYearReturn > 0 ? '+' : ''}${oneYearReturn.toFixed(2)}%` : '--'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Portfolio Value</p>
            <p className="text-lg sm:text-xl font-bold text-slate-800">
              {currentPortfolioValue ? `$${Math.round(currentPortfolioValue).toLocaleString()}` : '--'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {holdings.length} holdings{live && realReturns ? ' · live' : ''}
            </p>
          </div>
        </div>

        {/* Performance chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Portfolio vs Benchmark Performance</h2>
          <PerformanceChart
            holdings={holdings}
            benchmarkTicker={benchmark || null}
            createdAt={portfolio?.created_at}
            cashPercent={portfolio?.cash_percent ?? 0}
            drip={portfolio?.drip_enabled ?? true}
          />
        </div>

        {/* Individual holdings chart */}
        {holdings.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Individual Holdings Performance</h2>
            <HoldingsPerformanceChart holdings={holdings} />
          </div>
        )}

        {/* Holdings + Allocation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Holdings table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Your Holdings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Ticker</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Name</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Role</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.ticker} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-mono font-semibold text-slate-800">{h.ticker}</td>
                      <td className="py-2 pr-4 text-slate-600">{h.name}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          (h.category || 'Core') === 'Core' ? 'bg-blue-50 text-blue-700'
                            : (h.category || 'Core') === 'Tilt' ? 'bg-violet-50 text-violet-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {h.category || 'Core'}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-slate-700">{(h.weight_percent || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Allocation Wheel</h2>
            <AllocationPieChart holdings={holdings} />
            <div className="mt-4 space-y-2">
              {['Core', 'Tilt', 'Satellite'].map((cat) => {
                const COLORS = { Core: 'bg-blue-500', Tilt: 'bg-violet-500', Satellite: 'bg-amber-500' };
                const w = holdings
                  .filter((h) => (h.category || 'Core') === cat)
                  .reduce((s, h) => s + (h.weight_percent || 0), 0);
                if (w === 0) return null;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-16">{cat}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className={`${COLORS[cat]} h-2 rounded-full`} style={{ width: `${Math.min(w, 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-700 w-10 text-right">{w.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Messages with advisor + approve/comment */}
        {portfolio && (
          <MessagePanel
            portfolioId={portfolio.id}
            userId={user.id}
            userEmail={user.email}
            userRole="client"
            showApprovalActions={true}
          />
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          Powered by <span className="font-semibold text-blue-600">WeightWatch Portfolios</span>
        </p>
      </main>
    </div>
  );
}
