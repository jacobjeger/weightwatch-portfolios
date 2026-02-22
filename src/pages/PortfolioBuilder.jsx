import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy, Save, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth, getPortfolios, savePortfolio, deletePortfolios, logActivity } from '../context/AuthContext';
import { INSTRUMENTS, BENCHMARKS, getReturn, getPortfolioReturn } from '../lib/mockData';
import TickerSearch from '../components/TickerSearch';
import PerformanceChart from '../components/PerformanceChart';
import StatusBadge, { getPortfolioStatus } from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

const TIMEFRAMES = [
  { label: '1D', days: 1 },
  { label: '7D', days: 5 },
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '1Y', days: 252 },
];

export default function PortfolioBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = id === 'new';

  // Portfolio state
  const [name, setName]           = useState('New Portfolio');
  const [description, setDesc]    = useState('');
  const [benchmark, setBenchmark] = useState('');
  const [holdings, setHoldings]   = useState([]);
  const [portfolioId, setPortfolioId] = useState(isNew ? crypto.randomUUID() : id);

  // UI state
  const [saved, setSaved]           = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [weightErrors, setWeightErrors] = useState({});

  // Load existing portfolio
  useEffect(() => {
    if (!isNew && user) {
      const all = getPortfolios(user.id);
      const p = all.find((x) => x.id === id);
      if (p) {
        setName(p.name);
        setDesc(p.description ?? '');
        setBenchmark(p.primary_benchmark ?? '');
        setHoldings(p.holdings ?? []);
        setPortfolioId(p.id);
      }
    }
  }, [id, user, isNew]);

  // Derived
  const totalWeight = holdings.reduce((s, h) => s + parseFloat(h.weight_percent || 0), 0);
  const isFullyAllocated = Math.abs(totalWeight - 100) < 0.01;
  const status = getPortfolioStatus({ holdings, primary_benchmark: benchmark });

  // ── Holdings mutations ──────────────────────────────────────────────────────
  function addTicker(instrument) {
    if (holdings.find((h) => h.ticker === instrument.ticker)) return;
    setHoldings((prev) => [
      ...prev,
      {
        ticker: instrument.ticker,
        name: instrument.name,
        type: instrument.type,
        last_price: instrument.last_price,
        weight_percent: 0,
      },
    ]);
    setSaved(false);
  }

  function removeHolding(ticker) {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
    setSaved(false);
  }

  function updateWeight(ticker, raw) {
    const val = raw === '' ? '' : parseFloat(raw);
    setHoldings((prev) =>
      prev.map((h) => (h.ticker === ticker ? { ...h, weight_percent: val === '' ? 0 : isNaN(val) ? h.weight_percent : val } : h))
    );
    // Validate
    const v = parseFloat(raw);
    if (isNaN(v) || v < 0 || v > 100) {
      setWeightErrors((e) => ({ ...e, [ticker]: 'Must be 0–100' }));
    } else {
      setWeightErrors((e) => { const n = { ...e }; delete n[ticker]; return n; });
    }
    setSaved(false);
  }

  function normalize() {
    if (totalWeight === 0) return;
    setHoldings((prev) =>
      prev.map((h) => ({
        ...h,
        weight_percent: parseFloat(((h.weight_percent / totalWeight) * 100).toFixed(4)),
      }))
    );
    setWeightErrors({});
    setSaved(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const portfolio = {
      id: portfolioId,
      owner: user.id,
      name: name.trim(),
      description: description.trim(),
      primary_benchmark: benchmark || null,
      secondary_benchmarks: [],
      holdings,
    };
    savePortfolio(portfolio);
    logActivity(user.id, {
      portfolio_id: portfolioId,
      portfolio_name: portfolio.name,
      action_type: isNew ? 'Create' : 'Update',
      change_summary: `${isNew ? 'Created' : 'Updated'} "${portfolio.name}" (${holdings.length} holdings, ${totalWeight.toFixed(1)}% allocated)`,
    });
    setSaving(false);
    setSaved(true);
    if (isNew) navigate(`/portfolio/${portfolioId}`, { replace: true });
  }

  // ── Duplicate ───────────────────────────────────────────────────────────────
  function handleDuplicate() {
    const newId = crypto.randomUUID();
    const dup = {
      id: newId,
      owner: user.id,
      name: `${name} (Copy)`,
      description,
      primary_benchmark: benchmark || null,
      secondary_benchmarks: [],
      holdings: [...holdings],
    };
    savePortfolio(dup);
    logActivity(user.id, {
      portfolio_id: newId,
      portfolio_name: dup.name,
      action_type: 'Duplicate',
      change_summary: `Duplicated "${name}" → "${dup.name}"`,
    });
    navigate(`/portfolio/${newId}`);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  function handleDelete() {
    logActivity(user.id, {
      portfolio_id: portfolioId,
      portfolio_name: name,
      action_type: 'Delete',
      change_summary: `Deleted "${name}"`,
    });
    deletePortfolios([portfolioId]);
    navigate('/');
  }

  // ── Live snapshot daily moves (mock) ────────────────────────────────────────
  const topHoldings = [...holdings]
    .sort((a, b) => b.weight_percent - a.weight_percent)
    .slice(0, 5)
    .map((h) => ({
      ...h,
      dailyChange: parseFloat(getReturn(h.ticker, 1)),
    }));

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">Portfolio Builder</h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => navigate('/')}>← Dashboard</button>
          <button className="btn-secondary" onClick={handleDuplicate} disabled={isNew}>
            <Copy className="w-4 h-4" />Duplicate
          </button>
          <button className="btn-danger" onClick={() => setShowDelete(true)} disabled={isNew}>
            <Trash2 className="w-4 h-4" />Delete
          </button>
          <button
            className={saved ? 'btn bg-green-600 text-white' : 'btn-primary'}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? <><CheckCircle className="w-4 h-4" />Saved</> : <><Save className="w-4 h-4" />Save</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-6">

          {/* Portfolio meta */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title">Portfolio Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSaved(false); }}
                  placeholder="Portfolio name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Primary Benchmark</label>
                <select
                  className="input"
                  value={benchmark}
                  onChange={(e) => { setBenchmark(e.target.value); setSaved(false); }}
                >
                  <option value="">— None —</option>
                  {BENCHMARKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={description}
                onChange={(e) => { setDesc(e.target.value); setSaved(false); }}
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Holdings table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Holdings</h2>
              <div className="flex items-center gap-2">
                {!isFullyAllocated && holdings.length > 0 && (
                  <button className="btn-secondary text-xs" onClick={normalize}>
                    Normalize to 100%
                  </button>
                )}
                <TickerSearch
                  existingTickers={holdings.map((h) => h.ticker)}
                  onAdd={addTicker}
                />
              </div>
            </div>

            {holdings.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Use the search above to add tickers to this portfolio.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="th pl-0">Symbol</th>
                        <th className="th">Name</th>
                        <th className="th">Type</th>
                        <th className="th text-right">Last Price</th>
                        <th className="th text-right">Weight %</th>
                        <th className="th w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {holdings.map((h) => (
                        <tr key={h.ticker} className="group">
                          <td className="td pl-0 font-semibold text-slate-900">{h.ticker}</td>
                          <td className="td text-slate-600 max-w-xs truncate">{h.name}</td>
                          <td className="td">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              h.type === 'ETF' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>{h.type}</span>
                          </td>
                          <td className="td text-right font-mono text-slate-700">
                            ${h.last_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="td text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                className={`input w-24 text-right font-mono ${weightErrors[h.ticker] ? 'border-red-400' : ''}`}
                                value={h.weight_percent}
                                onChange={(e) => updateWeight(h.ticker, e.target.value)}
                              />
                              <span className="text-slate-400 text-sm">%</span>
                            </div>
                            {weightErrors[h.ticker] && (
                              <p className="text-xs text-red-500 mt-0.5 text-right">{weightErrors[h.ticker]}</p>
                            )}
                          </td>
                          <td className="td">
                            <button
                              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={() => removeHolding(h.ticker)}
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200">
                        <td colSpan={4} className="td font-semibold text-slate-700">Total Weight</td>
                        <td className={`td text-right font-semibold font-mono text-lg ${
                          isFullyAllocated ? 'text-green-600' : Math.abs(totalWeight - 100) < 5 ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                          {totalWeight.toFixed(2)}%
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Weight error banner */}
                {!isFullyAllocated && holdings.length > 0 && (
                  <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded ${
                    Math.abs(totalWeight - 100) < 0.01
                      ? 'bg-green-50 text-green-700'
                      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  }`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Weights sum to {totalWeight.toFixed(2)}% — must equal 100% to be fully allocated.
                    <button className="ml-auto underline text-xs" onClick={normalize}>Normalize</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Performance chart */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Performance Chart</h2>
            <PerformanceChart holdings={holdings} benchmarkTicker={benchmark || null} />
          </div>

          {/* Performance summary */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Performance Summary</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {TIMEFRAMES.map(({ label, days }) => {
                const portfolioRet = parseFloat(getPortfolioReturn(holdings, days));
                const benchRet = benchmark ? parseFloat(getReturn(benchmark, days)) : null;
                const outperf = benchRet !== null ? portfolioRet - benchRet : null;
                return (
                  <div key={label} className="bg-slate-50 rounded p-3 text-center">
                    <div className="text-xs font-medium text-slate-500 mb-2">{label}</div>
                    <div className={`text-sm font-bold ${portfolioRet > 0 ? 'text-green-600' : portfolioRet < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {holdings.length > 0 ? `${portfolioRet > 0 ? '+' : ''}${portfolioRet.toFixed(2)}%` : '—'}
                    </div>
                    {benchRet !== null && (
                      <div className="text-xs text-slate-400 mt-0.5">{benchmark}: {benchRet > 0 ? '+' : ''}{benchRet.toFixed(2)}%</div>
                    )}
                    {outperf !== null && holdings.length > 0 && (
                      <div className={`text-xs mt-1 font-medium ${outperf > 0 ? 'text-green-600' : outperf < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {outperf > 0 ? '▲' : outperf < 0 ? '▼' : '='} {Math.abs(outperf).toFixed(2)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar: live snapshot */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="section-title mb-1">Live Snapshot</h2>
            <p className="text-xs text-slate-400 mb-4">Top holdings by weight · simulated daily moves</p>

            {topHoldings.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-6">Add holdings to see snapshot</div>
            ) : (
              <div className="space-y-3">
                {topHoldings.map((h) => (
                  <div key={h.ticker} className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{h.ticker}</div>
                      <div className="text-xs text-slate-400">{h.weight_percent.toFixed(1)}% weight</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-slate-700">
                        ${h.last_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`text-xs font-medium flex items-center gap-0.5 justify-end ${
                        h.dailyChange > 0 ? 'text-green-600' : h.dailyChange < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {h.dailyChange > 0 ? <TrendingUp className="w-3 h-3" /> : h.dailyChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                        {h.dailyChange > 0 ? '+' : ''}{h.dailyChange.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Portfolio-level snapshot */}
            {holdings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Portfolio today</span>
                  <span className={`font-semibold ${
                    parseFloat(getPortfolioReturn(holdings, 1)) > 0 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {parseFloat(getPortfolioReturn(holdings, 1)) > 0 ? '+' : ''}{parseFloat(getPortfolioReturn(holdings, 1)).toFixed(2)}%
                  </span>
                </div>
                {benchmark && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-500">{benchmark} today</span>
                    <span className={`font-semibold ${parseFloat(getReturn(benchmark, 1)) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {parseFloat(getReturn(benchmark, 1)) > 0 ? '+' : ''}{parseFloat(getReturn(benchmark, 1)).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Weight breakdown */}
          {holdings.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title mb-3">Allocation</h2>
              <div className="space-y-2">
                {[...holdings].sort((a, b) => b.weight_percent - a.weight_percent).map((h) => (
                  <div key={h.ticker}>
                    <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                      <span className="font-medium">{h.ticker}</span>
                      <span>{h.weight_percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(h.weight_percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Total</span>
                <span className={`font-semibold ${isFullyAllocated ? 'text-green-600' : 'text-yellow-600'}`}>
                  {totalWeight.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDelete && (
        <ConfirmModal
          title={`Delete "${name}"?`}
          message="All holdings and history for this portfolio will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
