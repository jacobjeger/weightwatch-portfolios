import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, MessageCircle, CheckCircle, AlertTriangle, RefreshCw, Shield, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth, getPortfolios, getMessages, getLatestApproval } from '../context/AuthContext';
import { BENCHMARK_META, getPortfolioReturn, getPortfolioYTDReturn, getReturn, getYTDReturn, getPortfolioSinceReturn } from '../lib/mockData';
import { getRealPerformanceReturns } from '../lib/finnhub';
import { useMarketData } from '../context/MarketDataContext';
import PerformanceChart from '../components/PerformanceChart';
import HoldingsPerformanceChart from '../components/HoldingsPerformanceChart';
import AllocationPieChart from '../components/AllocationPieChart';
import MessagePanel from '../components/MessagePanel';

export default function ClientPortal() {
  const { user, role, refreshClientPortfolios } = useAuth();
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { live, prices, loadTickers, subscribeTickers } = useMarketData();
  const [realReturns, setRealReturns] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Load portfolios
  const loadPortfolios = useCallback(() => {
    if (user) {
      const all = getPortfolios(user.id);
      // Only show portfolios that are shared with this client (not owned by them)
      const clientPortfolios = all.filter((p) => p.owner !== user.id);
      setPortfolios(clientPortfolios.length > 0 ? clientPortfolios : all);
    }
  }, [user]);

  useEffect(() => { loadPortfolios(); }, [loadPortfolios]);

  // Calculate unread message counts for each portfolio
  useEffect(() => {
    if (!user || !portfolios.length) return;
    const counts = {};
    portfolios.forEach((p) => {
      const msgs = getMessages(p.id);
      counts[p.id] = msgs.filter((m) => m.sender_id !== user.id && m.sender_role === 'advisor').length;
    });
    setUnreadCounts(counts);
  }, [user, portfolios]);

  // Sync portfolios from advisor periodically
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await refreshClientPortfolios();
      loadPortfolios();
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  }, [refreshClientPortfolios, loadPortfolios]);

  // Auto-sync every 30 seconds
  useEffect(() => {
    if (!user || role !== 'client') return;
    handleSync(); // initial sync
    const interval = setInterval(handleSync, 30000);
    return () => clearInterval(interval);
  }, [user, role, handleSync]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">Client Portal</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            This portal is available for invited clients. Please use an invite link from your advisor to access your portfolio.
          </p>
        </div>
      </div>
    );
  }

  if (!portfolios.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">Welcome to Your Portal</h1>
          <p className="text-slate-500 mb-4">No portfolios have been shared with you yet.</p>
          <p className="text-sm text-slate-400">Ask your advisor for an invite link to get started.</p>
        </div>
      </div>
    );
  }

  const benchLabel = benchmark ? (BENCHMARK_META[benchmark]?.label ?? benchmark) : null;

  // Drifted weights using live prices
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

  // Performance metrics
  const ytdReturn = realReturns?.portfolio?.['YTD'] != null
    ? realReturns.portfolio['YTD']
    : (holdings.length ? parseFloat(getPortfolioYTDReturn(holdings)) : null);
  const sinceReturn = useMemo(() => {
    if (live && holdings.length && Object.keys(currentWeights).length) {
      const growthFactor = holdings.reduce(
        (s, h) => s + (h.weight_percent / 100) * (currentWeights[h.ticker]?.ratio ?? 1), 0
      );
      return parseFloat(((growthFactor - 1) * 100).toFixed(2));
    }
    return portfolio?.created_at && holdings.length
      ? parseFloat(getPortfolioSinceReturn(holdings, portfolio.created_at))
      : null;
  }, [live, holdings, currentWeights, portfolio]);
  const oneYearReturn = realReturns?.portfolio?.['1Y'] != null
    ? realReturns.portfolio['1Y']
    : (holdings.length ? parseFloat(getPortfolioReturn(holdings, 252)) : null);
  const benchYtd = realReturns?.benchmark?.['YTD'] != null
    ? realReturns.benchmark['YTD']
    : (benchmark ? parseFloat(getYTDReturn(benchmark)) : null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Client Portal Header - distinct from advisor */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 shadow-lg">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  Client Portal
                </span>
                {approval && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    approval.type === 'approval'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {approval.type === 'approval' ? (
                      <><CheckCircle className="w-3 h-3" /> Approved</>
                    ) : (
                      <><AlertTriangle className="w-3 h-3" /> Changes Requested</>
                    )}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{portfolio?.name || 'Portfolio'}</h1>
              {portfolio?.description && (
                <p className="text-sm text-slate-400 mt-0.5">{portfolio.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                title="Sync latest changes from advisor"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
              </button>
              <div className="text-right text-sm hidden sm:block">
                <p className="font-medium text-slate-300">{user.email}</p>
                {lastSync && (
                  <p className="text-xs text-slate-500">
                    Last synced {lastSync.toLocaleTimeString()}
                  </p>
                )}
                {portfolio?.created_at && !isNaN(new Date(portfolio.created_at).getTime()) && (
                  <p className="text-xs text-slate-500">Portfolio since {new Date(portfolio.created_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Portfolio selector if multiple */}
          {portfolios.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
              {portfolios.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedIdx(i); setRealReturns(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedIdx === i
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {p.name}
                  {unreadCounts[p.id] > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {unreadCounts[p.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Read-only notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <Eye className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">View-only access</p>
            <p className="text-xs text-blue-600">
              Your advisor manages this portfolio. You can view performance, leave comments, and approve or request changes.
            </p>
          </div>
        </div>

        {/* 1. ALLOCATION WHEEL + BREAKDOWN (first thing clients see) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Allocation Wheel</h2>
            <AllocationPieChart holdings={holdings} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Allocation Breakdown</h2>
            <div className="space-y-3">
              {['Core', 'Tilt', 'Satellite'].map((cat) => {
                const COLORS = { Core: 'bg-blue-500', Tilt: 'bg-violet-500', Satellite: 'bg-amber-500' };
                const catHoldings = holdings.filter((h) => (h.category || 'Core') === cat);
                const w = catHoldings.reduce((s, h) => s + (h.weight_percent || 0), 0);
                if (w === 0) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-600 w-16">{cat}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                        <div className={`${COLORS[cat]} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(w, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-700 w-12 text-right">{w.toFixed(1)}%</span>
                    </div>
                    <div className="ml-16 text-xs text-slate-400">
                      {catHoldings.map((h) => h.ticker).join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Quick stats */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Portfolio Value</p>
                <p className="text-lg font-bold text-slate-800">
                  {currentPortfolioValue ? `$${Math.round(currentPortfolioValue).toLocaleString()}` : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Holdings</p>
                <p className="text-lg font-bold text-slate-800">{holdings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PORTFOLIO PERFORMANCE CHART */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Portfolio vs Benchmark Performance
          </h2>
          <PerformanceChart
            holdings={holdings}
            benchmarkTicker={benchmark || null}
            createdAt={portfolio?.created_at}
            cashPercent={portfolio?.cash_percent ?? 0}
            drip={portfolio?.drip_enabled ?? true}
          />
        </div>

        {/* Performance summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <p className="text-xs font-medium text-slate-500 mb-1">Year-to-Date</p>
            <p className={`text-lg sm:text-xl font-bold ${ytdReturn > 0 ? 'text-emerald-600' : ytdReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {ytdReturn != null ? `${ytdReturn > 0 ? '+' : ''}${ytdReturn.toFixed(2)}%` : '--'}
            </p>
            {benchYtd != null && (
              <p className="text-xs text-slate-400 mt-1">
                {benchLabel}: {benchYtd > 0 ? '+' : ''}{benchYtd.toFixed(2)}%
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-400 to-indigo-500" />
            <p className="text-xs font-medium text-purple-600 mb-1">Since Creation</p>
            <p className={`text-lg sm:text-xl font-bold ${sinceReturn > 0 ? 'text-emerald-600' : sinceReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {sinceReturn != null ? `${sinceReturn > 0 ? '+' : ''}${sinceReturn.toFixed(2)}%` : '--'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-cyan-500" />
            <p className="text-xs font-medium text-slate-500 mb-1">1-Year Return</p>
            <p className={`text-lg sm:text-xl font-bold ${oneYearReturn > 0 ? 'text-emerald-600' : oneYearReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {oneYearReturn != null ? `${oneYearReturn > 0 ? '+' : ''}${oneYearReturn.toFixed(2)}%` : '--'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
            <p className="text-xs font-medium text-slate-500 mb-1">Portfolio Value</p>
            <p className="text-lg sm:text-xl font-bold text-slate-800">
              {currentPortfolioValue ? `$${Math.round(currentPortfolioValue).toLocaleString()}` : '--'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {holdings.length} holdings{live && realReturns ? ' · live' : ''}
            </p>
          </div>
        </div>

        {/* 3. INDIVIDUAL HOLDINGS PERFORMANCE CHART */}
        {holdings.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Individual Holdings Performance
            </h2>
            <HoldingsPerformanceChart holdings={holdings} />
          </div>
        )}

        {/* 4. EVERYTHING ELSE: Holdings table, details, messages */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Holdings table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              Your Holdings
              <span className="text-xs font-normal text-slate-400">({holdings.length} positions)</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Ticker</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Name</th>
                    <th className="hidden sm:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Role</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Target %</th>
                    <th className="hidden sm:table-cell text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Current %</th>
                    <th className="hidden sm:table-cell text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const drifted = currentWeights[h.ticker]?.driftedWeight;
                    const currentPrice = (live && prices[h.ticker]?.price) || h.last_price;
                    const dailyChange = live && prices[h.ticker]?.changePercent;
                    return (
                      <tr key={h.ticker} className="border-t border-slate-100">
                        <td className="py-2.5 pr-4">
                          <span className="font-mono font-semibold text-slate-800">{h.ticker}</span>
                        </td>
                        <td className="hidden sm:table-cell py-2.5 pr-4 text-slate-600">{h.name}</td>
                        <td className="hidden sm:table-cell py-2.5 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            (h.category || 'Core') === 'Core' ? 'bg-blue-50 text-blue-700'
                              : (h.category || 'Core') === 'Tilt' ? 'bg-violet-50 text-violet-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {h.category || 'Core'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-slate-700">{(h.weight_percent || 0).toFixed(1)}%</td>
                        <td className="hidden sm:table-cell py-2.5 pr-4 text-right">
                          {drifted != null ? (
                            <span className={`font-mono text-sm ${
                              Math.abs(drifted - h.weight_percent) < 0.5
                                ? 'text-slate-500'
                                : drifted > h.weight_percent
                                  ? 'text-emerald-600'
                                  : 'text-orange-500'
                            }`}>
                              {drifted.toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300">--</span>}
                        </td>
                        <td className="hidden sm:table-cell py-2.5 text-right">
                          <div className="font-mono text-slate-700">
                            ${currentPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {dailyChange != null && (
                            <div className={`text-xs flex items-center justify-end gap-0.5 ${
                              dailyChange > 0 ? 'text-emerald-500' : dailyChange < 0 ? 'text-red-500' : 'text-slate-400'
                            }`}>
                              {dailyChange > 0 ? <TrendingUp className="w-3 h-3" /> : dailyChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                              {dailyChange > 0 ? '+' : ''}{dailyChange.toFixed(2)}%
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td className="py-2.5 font-semibold text-slate-700">Total</td>
                    <td className="hidden sm:table-cell" />
                    <td className="hidden sm:table-cell" />
                    <td className="py-2.5 text-right font-semibold font-mono text-emerald-600">{totalWeight.toFixed(1)}%</td>
                    <td className="hidden sm:table-cell" />
                    <td className="hidden sm:table-cell py-2.5 text-right font-semibold font-mono text-slate-700">
                      ${currentPortfolioValue ? Math.round(currentPortfolioValue).toLocaleString() : '--'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Sidebar: details + approval */}
          <div className="space-y-4">
            {/* Portfolio details card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Portfolio Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Starting Value</span>
                  <span className="font-semibold text-slate-800">
                    ${(portfolio?.starting_value || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Current Value</span>
                  <span className="font-semibold text-slate-800">
                    ${currentPortfolioValue ? Math.round(currentPortfolioValue).toLocaleString() : '--'}
                  </span>
                </div>
                {benchmark && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Benchmark</span>
                    <span className="font-medium text-blue-600">{benchLabel || benchmark}</span>
                  </div>
                )}
                {cashPercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Cash Reserve</span>
                    <span className="font-medium text-slate-700">{cashPercent}%</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">DRIP</span>
                  <span className="font-medium text-slate-700">{portfolio?.drip_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                {portfolio?.created_at && !isNaN(new Date(portfolio.created_at).getTime()) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Created</span>
                    <span className="font-medium text-slate-700">{new Date(portfolio.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Approval status */}
            {approval && (
              <div className={`rounded-xl border p-4 ${
                approval.type === 'approval'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {approval.type === 'approval'
                    ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                    : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  <span className={`text-sm font-semibold ${
                    approval.type === 'approval' ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {approval.type === 'approval' ? 'Portfolio Approved' : 'Changes Requested'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {!isNaN(new Date(approval.created_at).getTime())
                    ? new Date(approval.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                    : ''}
                </p>
                {approval.text && approval.text !== 'Approved the portfolio' && approval.text !== 'Requested changes' && (
                  <p className="text-sm mt-1 text-slate-600">{approval.text}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages with advisor - always visible for clients */}
        {portfolio && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-700">Message Your Advisor</h2>
              <span className="text-xs text-slate-400">Communicate about your portfolio</span>
            </div>
            <div className="p-0">
              <MessagePanel
                portfolioId={portfolio.id}
                userId={user.id}
                userEmail={user.email}
                userRole="client"
                showApprovalActions={true}
                defaultOpen={true}
              />
            </div>
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            Managed by your advisor · Powered by <span className="font-semibold text-emerald-600">AJA Wealth Management</span>
          </p>
        </div>
      </main>
    </div>
  );
}
