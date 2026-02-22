import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, RefreshCw, BarChart3 } from 'lucide-react';
import { useAuth, getPortfolios, savePortfolio, deletePortfolios, logActivity } from '../context/AuthContext';
import { getPortfolioReturn } from '../lib/mockData';
import StatusBadge, { getPortfolioStatus } from '../components/StatusBadge';
import NewPortfolioModal from '../components/NewPortfolioModal';
import ConfirmModal from '../components/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';

const TIMEFRAME_DAYS = { '1D': 1, '1M': 21, '3M': 63, '1Y': 252 };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [portfolios, setPortfolios] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [showNew, setShowNew] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [perfTimeframe, setPerfTimeframe] = useState('1Y');

  function load() {
    if (user) setPortfolios(getPortfolios(user.id));
  }

  useEffect(() => { load(); }, [user]);

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
    deletePortfolios(ids);
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
    if (selected.size === portfolios.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(portfolios.map((p) => p.id)));
    }
  }

  const days = TIMEFRAME_DAYS[perfTimeframe] ?? 252;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Portfolios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button
              className="btn-danger"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete {selected.size}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            New Portfolio
          </button>
        </div>
      </div>

      {/* Performance timeframe selector */}
      <div className="flex items-center gap-1 mb-3">
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
          <p className="text-slate-500 mb-2">No portfolios yet.</p>
          <p className="text-sm text-slate-400 mb-6">Build your first portfolio to start tracking performance.</p>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />
            Build your first portfolio →
          </button>
        </div>
      ) : (
        <>
          {/* Mobile card list — hidden on sm+ */}
          <div className="sm:hidden space-y-3">
            {portfolios.map((p) => {
              const status = getPortfolioStatus(p);
              const totalWeight = (p.holdings ?? []).reduce((s, h) => s + (h.weight_percent ?? 0), 0);
              const ret = parseFloat(getPortfolioReturn(p.holdings, days));
              const retColor = ret > 0 ? 'text-green-600' : ret < 0 ? 'text-red-500' : 'text-slate-500';
              return (
                <div
                  key={p.id}
                  className="card p-4 flex items-center justify-between gap-3 cursor-pointer active:bg-slate-50"
                  onClick={() => navigate(`/portfolio/${p.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 flex-shrink-0"
                      checked={selected.has(p.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
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
                      {p.holdings?.length > 0 ? `${ret > 0 ? '+' : ''}${ret.toFixed(2)}%` : '—'}
                    </div>
                    <div className="text-xs text-slate-400">{p.holdings?.length ?? 0} holdings</div>
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
                        checked={selected.size === portfolios.length && portfolios.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="th">Portfolio Name</th>
                    <th className="th">Primary Benchmark</th>
                    <th className="th">Performance ({perfTimeframe})</th>
                    <th className="th">Holdings</th>
                    <th className="th">Last Updated</th>
                    <th className="th">Status</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {portfolios.map((p) => {
                    const status = getPortfolioStatus(p);
                    const totalWeight = (p.holdings ?? []).reduce((s, h) => s + (h.weight_percent ?? 0), 0);
                    const ret = parseFloat(getPortfolioReturn(p.holdings, days));
                    const retColor = ret > 0 ? 'text-green-600' : ret < 0 ? 'text-red-500' : 'text-slate-500';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/portfolio/${p.id}`)}
                      >
                        <td className="td" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                          />
                        </td>
                        <td className="td">
                          <div className="font-semibold text-slate-900">{p.name}</div>
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
                          {p.holdings?.length > 0 ? (
                            <span className={`font-semibold ${retColor}`}>
                              {ret > 0 ? '+' : ''}{ret.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">No holdings</span>
                          )}
                        </td>
                        <td className="td">
                          <span className="text-slate-600">{p.holdings?.length ?? 0}</span>
                        </td>
                        <td className="td text-slate-500 text-xs">
                          {formatDistanceToNow(new Date(p.last_updated_at), { addSuffix: true })}
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
