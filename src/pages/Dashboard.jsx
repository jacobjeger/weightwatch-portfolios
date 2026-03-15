import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, RefreshCw, BarChart3, Search, Star } from 'lucide-react';
import { useAuth, getPortfolios, savePortfolio, deletePortfolios, logActivity, getSettings, saveSettings } from '../context/AuthContext';
import { getPortfolioReturn, getPortfolioYTDReturn } from '../lib/mockData';
import StatusBadge, { getPortfolioStatus } from '../components/StatusBadge';
import NewPortfolioModal from '../components/NewPortfolioModal';
import ConfirmModal from '../components/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { useMarketData } from '../context/MarketDataContext';

const TIMEFRAME_DAYS = { '1D': 1, '1M': 21, '3M': 63, 'YTD': null, '1Y': 252 };

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { live, prices, loadTickers } = useMarketData();
  const isClient = role === 'client';

  const [portfolios, setPortfolios] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [showNew, setShowNew] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [perfTimeframe, setPerfTimeframe] = useState('YTD');
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [favVersion, setFavVersion] = useState(0);
  const longPressedRef = useRef(false);

  // Clients should always see the client portal, never the advisor dashboard
  useEffect(() => {
    if (isClient) navigate('/client-portal', { replace: true });
  }, [isClient, navigate]);

  function load() {
    if (user) setPortfolios(getPortfolios(user.id));
  }

  useEffect(() => { load(); }, [user]);

  // Pre-fetch real quotes for all tickers visible on the dashboard
  useEffect(() => {
    if (!live || !portfolios.length) return;
    const allTickers = [...new Set(
      portfolios.flatMap((p) => (p.holdings ?? []).map((h) => h.ticker))
    )];
    if (allTickers.length) loadTickers(allTickers);
  }, [live, portfolios, loadTickers]);

  // Close context menu on scroll or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // Favorites
  const favoriteIds = new Set(
    (user ? getSettings(user.id) : {}).favorite_portfolio_ids ?? []
  );
  // Force re-read when favVersion changes
  void favVersion;

  function toggleFavorite(portfolioId) {
    const current = getSettings(user.id).favorite_portfolio_ids ?? [];
    const next = current.includes(portfolioId)
      ? current.filter((id) => id !== portfolioId)
      : [...current, portfolioId];
    saveSettings(user.id, { favorite_portfolio_ids: next });
    setContextMenu(null);
    setFavVersion((v) => v + 1);
  }

  // Filter and sort: favorites first, then alphabetical
  const filtered = portfolios.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) => {
    const aFav = favoriteIds.has(a.id);
    const bFav = favoriteIds.has(b.id);
    if (aFav !== bFav) return aFav ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  function handleCreate(data) {
    const portfolio = savePortfolio({
      id: crypto.randomUUID(),
      owner: user.id,
      name: data.name,
      description: data.description,
      primary_benchmark: data.primary_benchmark,
      secondary_benchmarks: [],
      holdings: [],
    });
    logActivity(user.id, {
      portfolio_id: portfolio.id,
      portfolio_name: portfolio.name,
      action_type: 'Create',
      change_summary: `Created portfolio "${portfolio.name}"`,
    });
    setShowNew(false);
    navigate(`/portfolio/${portfolio.id}`);
  }

  function handleDelete() {
    const ids = [...selected];
    const names = portfolios.filter((p) => ids.includes(p.id)).map((p) => p.name);
    deletePortfolios(ids, user.id);
    ids.forEach((id, i) => {
      logActivity(user.id, {
        portfolio_id: id,
        portfolio_name: names[i],
        action_type: 'Delete',
        change_summary: `Deleted portfolio "${names[i]}"`,
      });
    });
    setSelected(new Set());
    setShowDelete(false);
    load();
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((p) => p.id)));
    }
  }

  function openContextMenu(e, portfolioId) {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 100);
    setContextMenu({ x, y, portfolioId });
  }

  function handleTouchStart(e, portfolioId) {
    longPressedRef.current = false;
    const touch = e.touches[0];
    const timer = setTimeout(() => {
      longPressedRef.current = true;
      setContextMenu({
        x: Math.min(touch.clientX, window.innerWidth - 200),
        y: Math.min(touch.clientY, window.innerHeight - 100),
        portfolioId,
      });
    }, 500);
    e.currentTarget._lpt = timer;
  }

  function handleTouchEnd(e) {
    clearTimeout(e.currentTarget._lpt);
  }

  const days = TIMEFRAME_DAYS[perfTimeframe] ?? 252;

  // Compute portfolio performance for the selected timeframe.
  function portfolioPerf(portfolio) {
    const holdings = portfolio.holdings ?? [];
    if (!holdings.length) return null;
    if (live && perfTimeframe === '1D') {
      let weightedReturn = 0;
      let coveredWeight  = 0;
      holdings.forEach((h) => {
        const cp = prices[h.ticker]?.changePercent;
        if (cp != null) {
          weightedReturn += cp * (h.weight_percent / 100);
          coveredWeight  += h.weight_percent;
        }
      });
      if (coveredWeight >= 50) return weightedReturn;
    }
    if (perfTimeframe === 'YTD') {
      return parseFloat(getPortfolioYTDReturn(holdings));
    }
    return parseFloat(getPortfolioReturn(holdings, days));
  }

  // Compute current portfolio value using live prices when available
  function computeValue(p) {
    const sv = p.starting_value || 0;
    if (!(p.holdings?.length) || !sv) return sv;
    const cashPct = p.cash_percent ?? 0;
    const investedFrac = 1 - cashPct / 100;
    const growthFactor = p.holdings.reduce((s, h) => {
      const currentPrice = (live && prices[h.ticker]?.price) || h.last_price;
      const entryPrice = h.entry_price ?? h.last_price;
      const ratio = entryPrice > 0 ? currentPrice / entryPrice : 1;
      return s + (h.weight_percent / 100) * ratio;
    }, 0);
    return sv * (growthFactor * investedFrac + cashPct / 100);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isClient ? 'My Managed Portfolios' : 'My Portfolios'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {search
              ? `${filtered.length} of ${portfolios.length} portfolio${portfolios.length !== 1 ? 's' : ''}`
              : `${portfolios.length} portfolio${portfolios.length !== 1 ? 's' : ''}`}
            {isClient && ' · managed by your advisor'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search portfolios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 w-48 sm:w-56"
            />
          </div>
          {!isClient && selected.size > 0 && (
            <button
              className="btn-danger"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete {selected.size}
            </button>
          )}
          {!isClient && (
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">New Portfolio</span>
              <span className="xs:hidden">New</span>
            </button>
          )}
        </div>
      </div>

      {/* Performance timeframe selector */}
      <div className="flex flex-wrap items-center gap-1 mb-3">
        <span className="text-xs text-slate-500 mr-2">Performance:</span>
        {Object.keys(TIMEFRAME_DAYS).map((tf) => (
          <button
            key={tf}
            onClick={() => setPerfTimeframe(tf)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              perfTimeframe === tf
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tf}
          </button>
        ))}
        <button onClick={load} className="ml-2 text-slate-400 hover:text-slate-600" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table / Cards */}
      {portfolios.length === 0 ? (
        <div className="card p-16 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          {isClient ? (
            <>
              <p className="text-slate-500 mb-2">No portfolios shared with you yet.</p>
              <p className="text-sm text-slate-400 mb-6">Ask your advisor for an invite link to get started.</p>
            </>
          ) : (
            <>
              <p className="text-slate-500 mb-2">No portfolios yet.</p>
              <p className="text-sm text-slate-400 mb-6">Build your first portfolio to start tracking performance.</p>
              <button className="btn-primary" onClick={() => setShowNew(true)}>
                <Plus className="w-4 h-4" />
                Build your first portfolio →
              </button>
            </>
          )}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No portfolios match "{search}"</p>
        </div>
      ) : (
        <>
          {/* Mobile card list — hidden on sm+ */}
          <div className="sm:hidden space-y-3">
            {sorted.map((p) => {
              const status = getPortfolioStatus(p);
              const totalWeight = (p.holdings ?? []).reduce((s, h) => s + (h.weight_percent ?? 0), 0);
              const ret = portfolioPerf(p);
              const retColor = ret == null ? 'text-slate-400' : ret > 0 ? 'text-green-600' : ret < 0 ? 'text-red-500' : 'text-slate-500';
              return (
                <div
                  key={p.id}
                  className="card p-4 flex items-center justify-between gap-3 cursor-pointer active:bg-slate-50"
                  onClick={() => { if (longPressedRef.current) { longPressedRef.current = false; return; } navigate(isClient ? '/client-portal' : `/portfolio/${p.id}`); }}
                  onContextMenu={(e) => openContextMenu(e, p.id)}
                  onTouchStart={(e) => handleTouchStart(e, p.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={(e) => { clearTimeout(e.currentTarget._lpt); longPressedRef.current = false; }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {!isClient && <input
                      type="checkbox"
                      className="rounded border-slate-300 flex-shrink-0"
                      checked={selected.has(p.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      onClick={(e) => e.stopPropagation()}
                    />}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        {favoriteIds.has(p.id) && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <StatusBadge status={status} totalWeight={totalWeight} />
                        {p.primary_benchmark && (
                          <span className="text-xs text-slate-400">{p.primary_benchmark}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-semibold text-sm ${retColor}`}>
                      {ret != null ? `${ret > 0 ? '+' : ''}${ret.toFixed(2)}%` : '—'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.starting_value ? `$${Math.round(computeValue(p)).toLocaleString()} · ` : ''}{p.holdings?.length ?? 0} holdings
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table — hidden on mobile */}
          <div className="card overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th w-10">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected.size === sorted.length && sorted.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="th">Portfolio Name</th>
                    <th className="th">Primary Benchmark</th>
                    <th className="th">Performance ({perfTimeframe})</th>
                    <th className="th text-right">Value</th>
                    <th className="th">Holdings</th>
                    <th className="th">Last Updated</th>
                    <th className="th">Status</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((p) => {
                    const status = getPortfolioStatus(p);
                    const totalWeight = (p.holdings ?? []).reduce((s, h) => s + (h.weight_percent ?? 0), 0);
                    const ret = portfolioPerf(p);
                    const retColor = ret == null ? 'text-slate-400' : ret > 0 ? 'text-green-600' : ret < 0 ? 'text-red-500' : 'text-slate-500';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(isClient ? '/client-portal' : `/portfolio/${p.id}`)}
                        onContextMenu={(e) => openContextMenu(e, p.id)}
                      >
                        <td className="td" onClick={(e) => e.stopPropagation()}>
                          {!isClient && <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                          />}
                        </td>
                        <td className="td">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {favoriteIds.has(p.id) && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                            {p.name}
                          </div>
                          {p.description && (
                            <div
                              className="text-xs text-slate-400 mt-0.5 max-w-xs truncate"
                              title={p.description}
                            >
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="td">
                          {p.primary_benchmark ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                              {p.primary_benchmark}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="td">
                          {ret != null ? (
                            <span className={`font-semibold ${retColor}`}>
                              {ret > 0 ? '+' : ''}{ret.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">No holdings</span>
                          )}
                        </td>
                        <td className="td text-right font-mono text-slate-700 text-sm">
                          {p.starting_value
                            ? `$${Math.round(computeValue(p)).toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="td">
                          <span className="text-slate-600">{p.holdings?.length ?? 0}</span>
                        </td>
                        <td className="td text-slate-500 text-xs">
                          {p.last_updated_at && !isNaN(new Date(p.last_updated_at).getTime())
                            ? formatDistanceToNow(new Date(p.last_updated_at), { addSuffix: true })
                            : '—'}
                        </td>
                        <td className="td">
                          <StatusBadge status={status} totalWeight={totalWeight} />
                        </td>
                        <td className="td" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="text-slate-400 hover:text-blue-600 p-1 rounded"
                            onClick={() => navigate(`/portfolio/${p.id}`)}
                            title="Open"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
              onClick={() => toggleFavorite(contextMenu.portfolioId)}
            >
              <Star className={`w-4 h-4 ${favoriteIds.has(contextMenu.portfolioId) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
              {favoriteIds.has(contextMenu.portfolioId) ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
                setSelected(new Set([contextMenu.portfolioId]));
                setShowDelete(true);
                setContextMenu(null);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNew && <NewPortfolioModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
      {showDelete && (
        <ConfirmModal
          title={`Delete ${selected.size} portfolio${selected.size > 1 ? 's' : ''}?`}
          message="This action cannot be undone. All holdings and performance history for the selected portfolios will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
