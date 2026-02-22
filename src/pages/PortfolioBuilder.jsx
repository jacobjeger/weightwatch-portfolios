import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy, Save, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useAuth, getPortfolios, savePortfolio, deletePortfolios, logActivity } from '../context/AuthContext';
import { INSTRUMENTS, BENCHMARKS, BENCHMARK_META, getReturn, getPortfolioReturn } from '../lib/mockData';
import TickerSearch from '../components/TickerSearch';
import PerformanceChart from '../components/PerformanceChart';
import StatusBadge, { getPortfolioStatus } from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { useMarketData } from '../context/MarketDataContext';

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
  const toast = useToast();
  const { live, prices, loadTickers, subscribeTickers } = useMarketData();

  const isNew = id === 'new';

  // Portfolio state
  const [name, setName]               = useState('New Portfolio');
  const [description, setDesc]        = useState('');
  const [benchmark, setBenchmark]     = useState('');
  const [holdings, setHoldings]       = useState([]);
  const [portfolioId, setPortfolioId] = useState(isNew ? crypto.randomUUID() : id);
  const [createdAt, setCreatedAt]     = useState(null);
  const [drip, setDrip]               = useState(true);   // dividend reinvestment
  const [cashPercent, setCashPercent] = useState(0);      // % held as cash
  const [startingValue, setStartingValue] = useState(100_000); // $ portfolio size
  const [weightHistory, setWeightHistory] = useState([]);      // log of weight changes
  const [historyOpen, setHistoryOpen]     = useState(false);   // history panel toggle

  // UI state
  const [showDelete, setShowDelete]         = useState(false);
  const [showRebalance, setShowRebalance]   = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [weightErrors, setWeightErrors]     = useState({});

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
        setCreatedAt(p.created_at ?? null);
        setDrip(p.drip_enabled ?? true);
        setCashPercent(p.cash_percent ?? 0);
        setStartingValue(p.starting_value ?? 100_000);
        setWeightHistory(p.weight_history ?? []);
      }
    }
  }, [id, user, isNew]);

  // Load + subscribe real-time prices whenever holdings change
  useEffect(() => {
    if (!live || !holdings.length) return;
    const tickers = holdings.map((h) => h.ticker);
    loadTickers(tickers);
    const unsub = subscribeTickers(tickers);
    return unsub;
  }, [live, holdings, loadTickers, subscribeTickers]);

  // Derived
  const totalWeight = holdings.reduce((s, h) => s + parseFloat(h.weight_percent || 0), 0);
  const isFullyAllocated = Math.abs(totalWeight - 100) < 0.01;
  const status = getPortfolioStatus({ holdings, primary_benchmark: benchmark });

  // Drifted weights: what each holding's actual weight is given price movements since entry
  const currentWeights = useMemo(() => {
    if (!holdings.length) return {};
    const rows = holdings.map((h) => {
      const currentPrice = (live && prices[h.ticker]?.price) || h.last_price;
      const entryPrice   = h.entry_price ?? h.last_price;
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

  // Current estimated portfolio value in dollars
  const currentPortfolioValue = useMemo(() => {
    if (!holdings.length) return startingValue;
    const investedFrac = 1 - cashPercent / 100;
    const growthFactor = holdings.reduce(
      (s, h) => s + (h.weight_percent / 100) * (currentWeights[h.ticker]?.ratio ?? 1), 0
    );
    return startingValue * (growthFactor * investedFrac + cashPercent / 100);
  }, [holdings, currentWeights, startingValue, cashPercent]);

  // Show Rebalance button when any holding has drifted ≥ 0.5% from its target
  const needsRebalance = useMemo(() =>
    holdings.some((h) =>
      Math.abs((currentWeights[h.ticker]?.driftedWeight ?? h.weight_percent) - h.weight_percent) >= 0.5
    ), [holdings, currentWeights]
  );

  // ── Holdings mutations ──────────────────────────────────────────────────────
  function addTicker(instrument) {
    if (holdings.find((h) => h.ticker === instrument.ticker)) return;
    // Capture entry price at time of adding — used for drift / rebalance calculations
    const entryPrice = (live && prices[instrument.ticker]?.price)
      ? prices[instrument.ticker].price
      : (instrument.last_price ?? 0);
    setHoldings((prev) => [
      ...prev,
      {
        ticker: instrument.ticker,
        name: instrument.name,
        type: instrument.type,
        last_price: instrument.last_price,
        entry_price: entryPrice,
        weight_percent: 0,
      },
    ]);
  }

  function removeHolding(ticker) {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
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
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    // ── Weight history diffing ────────────────────────────────────────────────
    const allSaved   = getPortfolios(user.id);
    const savedPortf = allSaved.find((p) => p.id === portfolioId);
    const prevHistory = savedPortf?.weight_history ?? weightHistory;

    let newEvent = null;
    if (!savedPortf) {
      // Brand-new portfolio
      newEvent = {
        id: crypto.randomUUID(), date: new Date().toISOString(), type: 'created',
        changes: holdings.map((h) => ({ ticker: h.ticker, from: null, to: h.weight_percent })),
      };
    } else {
      const prevMap = Object.fromEntries((savedPortf.holdings ?? []).map((h) => [h.ticker, h.weight_percent]));
      const changes = [];
      holdings.forEach((h) => {
        const prev = prevMap[h.ticker];
        if (prev == null) {
          changes.push({ ticker: h.ticker, from: null, to: h.weight_percent });
        } else if (Math.abs(prev - h.weight_percent) >= 0.01) {
          changes.push({ ticker: h.ticker, from: prev, to: h.weight_percent });
        }
      });
      (savedPortf.holdings ?? []).forEach((h) => {
        if (!holdings.find((c) => c.ticker === h.ticker))
          changes.push({ ticker: h.ticker, from: h.weight_percent, to: null });
      });
      if (changes.length) {
        const type = changes.every((c) => c.from == null)  ? 'holding_added'
                   : changes.every((c) => c.to   == null)  ? 'holding_removed'
                   : 'adjustment';
        newEvent = { id: crypto.randomUUID(), date: new Date().toISOString(), type, changes };
      }
    }
    const updatedHistory = newEvent ? [...prevHistory, newEvent] : prevHistory;
    if (newEvent) setWeightHistory(updatedHistory);

    const portfolio = {
      id:                  portfolioId,
      owner:               user.id,
      name:                name.trim(),
      description:         description.trim(),
      primary_benchmark:   benchmark || null,
      secondary_benchmarks: [],
      holdings,
      drip_enabled:        drip,
      cash_percent:        cashPercent,
      starting_value:      startingValue,
      created_at:          createdAt ?? new Date().toISOString(),
      weight_history:      updatedHistory,
    };
    savePortfolio(portfolio);
    logActivity(user.id, {
      portfolio_id: portfolioId,
      portfolio_name: portfolio.name,
      action_type: isNew ? 'Create' : 'Update',
      change_summary: `${isNew ? 'Created' : 'Updated'} "${portfolio.name}" (${holdings.length} holdings, ${totalWeight.toFixed(1)}% allocated)`,
    });
    setSaving(false);
    toast.success('Portfolio saved');
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
    deletePortfolios([portfolioId], user.id);
    navigate('/');
  }

  // ── Rebalance ────────────────────────────────────────────────────────────────
  // Resets each holding's entry_price to its current price, zeroing the drift.
  // Logs a 'rebalance' event showing before (drifted) → after (target) weights.
  function handleRebalance() {
    const rebalanceEvent = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: 'rebalance',
      changes: holdings.map((h) => ({
        ticker: h.ticker,
        from: parseFloat((currentWeights[h.ticker]?.driftedWeight ?? h.weight_percent).toFixed(2)),
        to: h.weight_percent,
      })),
    };
    const rebalancedHoldings = holdings.map((h) => ({
      ...h,
      entry_price: (live && prices[h.ticker]?.price) || h.last_price,
    }));
    const newHistory = [...weightHistory, rebalanceEvent];
    const portfolio = {
      id:                  portfolioId,
      owner:               user.id,
      name:                name.trim(),
      description:         description.trim(),
      primary_benchmark:   benchmark || null,
      secondary_benchmarks: [],
      holdings:            rebalancedHoldings,
      drip_enabled:        drip,
      cash_percent:        cashPercent,
      starting_value:      startingValue,
      created_at:          createdAt ?? new Date().toISOString(),
      weight_history:      newHistory,
    };
    savePortfolio(portfolio);
    setHoldings(rebalancedHoldings);
    setWeightHistory(newHistory);
    setShowRebalance(false);
    toast.success('Portfolio rebalanced to target weights');
  }

  // ── Live snapshot daily moves ────────────────────────────────────────────────
  // Uses real Finnhub prices when configured, falls back to mock data
  const topHoldings = [...holdings]
    .sort((a, b) => b.weight_percent - a.weight_percent)
    .slice(0, 5)
    .map((h) => {
      const realQuote = live ? prices[h.ticker] : null;
      return {
        ...h,
        displayPrice:  realQuote?.price       ?? h.last_price,
        dailyChange:   realQuote?.changePercent ?? parseFloat(getReturn(h.ticker, 1)),
        isLive:        !!realQuote,
      };
    });

  // Portfolio-level 1D return
  const portfolioReturn1D = live && holdings.length > 0
    ? holdings.reduce((sum, h) => {
        const cp = prices[h.ticker]?.changePercent;
        return sum + (cp != null ? cp * (h.weight_percent / 100) : 0);
      }, 0)
    : parseFloat(getPortfolioReturn(holdings, 1));

  const benchmarkReturn1D = benchmark
    ? (live && prices[benchmark]?.changePercent != null
        ? prices[benchmark].changePercent
        : parseFloat(getReturn(benchmark, 1)))
    : null;

  // Weighted expense ratio and dividend yield (adjusted for cash allocation)
  const investedFraction = 1 - cashPercent / 100;
  const weightedER = holdings.reduce((sum, h) => {
    const inst = INSTRUMENTS.find((i) => i.ticker === h.ticker);
    return sum + (h.weight_percent / 100) * (inst?.expense_ratio ?? 0);
  }, 0) * investedFraction;

  const weightedYield = holdings.reduce((sum, h) => {
    const inst = INSTRUMENTS.find((i) => i.ticker === h.ticker);
    return sum + (h.weight_percent / 100) * (inst?.div_yield ?? 0);
  }, 0) * investedFraction;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">Portfolio Builder</h1>
          <StatusBadge status={status} totalWeight={totalWeight} />
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
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Portfolio name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Primary Benchmark</label>
                <select
                  className="input"
                  value={benchmark}
                  onChange={(e) => setBenchmark(e.target.value)}
                >
                  <option value="">— None —</option>
                  {BENCHMARKS.map((b) => (
                    <option key={b} value={b}>
                      {BENCHMARK_META[b]?.label ?? b} ({b})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            {/* Starting value + Starting date row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Starting Value
                  <span className="ml-1 text-xs font-normal text-slate-400">initial portfolio size</span>
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    className="input text-right font-mono"
                    value={startingValue}
                    onChange={(e) => setStartingValue(Math.max(1000, parseFloat(e.target.value) || 100_000))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Starting Date
                  <span className="ml-1 text-xs font-normal text-slate-400">sets "Since Creation" range</span>
                </label>
                <input
                  type="date"
                  className="input"
                  value={createdAt ? createdAt.slice(0, 10) : ''}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCreatedAt(new Date(e.target.value + 'T12:00:00').toISOString());
                    } else {
                      setCreatedAt(null);
                    }
                  }}
                />
              </div>
            </div>

            {/* Cash + DRIP row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cash Reserve
                  <span className="ml-1 text-xs font-normal text-slate-400">% of portfolio held as cash</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="input w-24 text-right font-mono"
                    value={cashPercent}
                    onChange={(e) => setCashPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  />
                  <span className="text-slate-400 text-sm">%</span>
                  {cashPercent > 0 && (
                    <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
                      <DollarSign className="w-3 h-3" />{cashPercent}% cash earning ~5% p.a.
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dividend Reinvestment</label>
                <label className="flex items-center gap-3 cursor-pointer mt-1.5">
                  <div
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${drip ? 'bg-blue-600' : 'bg-slate-300'}`}
                    onClick={() => setDrip(!drip)}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${drip ? 'translate-x-4' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-slate-700">
                    {drip ? 'DRIP enabled — dividends auto-reinvested' : 'DRIP off — dividends go to cash'}
                  </span>
                </label>
              </div>
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
                {needsRebalance && (
                  <button className="btn-secondary text-xs" onClick={() => setShowRebalance(true)}>
                    ⟳ Rebalance
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
                        <th className="th text-right">Target %</th>
                        <th className="th text-right">Current %</th>
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
                            {(() => {
                              const lp = live && prices[h.ticker]?.price
                                ? prices[h.ticker].price
                                : h.last_price;
                              const isReal = live && prices[h.ticker]?.price;
                              return (
                                <span>
                                  ${lp?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {isReal && <span className="ml-1 text-green-500 text-xs">●</span>}
                                </span>
                              );
                            })()}
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
                          {/* Current (drifted) weight — read-only, color-coded vs target */}
                          <td className="td text-right">
                            {(() => {
                              const drifted = currentWeights[h.ticker]?.driftedWeight;
                              if (drifted == null) return <span className="text-slate-300 text-xs">—</span>;
                              const diff = drifted - h.weight_percent;
                              return (
                                <span className={`font-mono text-sm ${
                                  Math.abs(diff) < 0.5
                                    ? 'text-slate-500'
                                    : diff > 0
                                      ? 'text-green-600 font-semibold'
                                      : 'text-orange-500 font-semibold'
                                }`}>
                                  {drifted.toFixed(2)}%
                                </span>
                              );
                            })()}
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
                        <td />{/* Current % — no total needed */}
                        <td />{/* Delete button column */}
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Performance Chart</h2>
              {cashPercent > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Includes {cashPercent}% cash · {drip ? 'DRIP on' : 'DRIP off'}
                </span>
              )}
            </div>
            <PerformanceChart
              holdings={holdings}
              benchmarkTicker={benchmark || null}
              createdAt={createdAt}
              cashPercent={cashPercent}
              drip={drip}
            />
          </div>

          {/* Performance summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Performance Summary</h2>
              <span className="text-xs text-slate-400 italic">
                {createdAt ? 'Real since start date · simulated before' : 'All figures backtested / simulated'}
              </span>
            </div>
            {(() => {
              // Portfolio age in approximate trading days (252/year)
              const portfolioAgeTradingDays = createdAt
                ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000 * (252 / 365))
                : 0;
              return (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {TIMEFRAMES.map(({ label, days }) => {
                    const portfolioRet = parseFloat(getPortfolioReturn(holdings, days));
                    const benchRet = benchmark ? parseFloat(getReturn(benchmark, days)) : null;
                    const outperf = benchRet !== null ? portfolioRet - benchRet : null;
                    // Backtested = portfolio hasn't existed long enough to have real data for this window
                    const isBacktested = !createdAt || portfolioAgeTradingDays < days;
                    return (
                      <div key={label} className={`rounded p-3 text-center ${isBacktested ? 'bg-slate-50/60' : 'bg-slate-50'}`}>
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
                        {isBacktested && holdings.length > 0 && (
                          <div className="text-xs text-slate-400 italic mt-1">Backtested</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Weight History — collapsible log of all weight changes, rebalances, and additions */}
          {weightHistory.length > 0 && (
            <div className="card p-5">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setHistoryOpen((o) => !o)}
              >
                <h2 className="section-title">
                  Weight History
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({weightHistory.length} event{weightHistory.length !== 1 ? 's' : ''})
                  </span>
                </h2>
                <span className="text-slate-400 text-sm">{historyOpen ? '▲' : '▼'}</span>
              </button>
              {historyOpen && (
                <div className="mt-4 space-y-3">
                  {[...weightHistory].reverse().map((event) => {
                    const typeConfig = {
                      created:         { icon: '★', color: 'text-blue-500',  label: 'Portfolio created' },
                      rebalance:       { icon: '⟳', color: 'text-green-600', label: 'Rebalanced to targets' },
                      adjustment:      { icon: '↕', color: 'text-amber-500', label: 'Weights adjusted' },
                      holding_added:   { icon: '+', color: 'text-blue-500',  label: 'Holdings added' },
                      holding_removed: { icon: '−', color: 'text-red-500',   label: 'Holdings removed' },
                    }[event.type] ?? { icon: '·', color: 'text-slate-400', label: event.type };
                    return (
                      <div key={event.id} className="flex gap-3 text-sm">
                        <div className={`flex-shrink-0 w-5 text-center font-bold mt-0.5 ${typeConfig.color}`}>
                          {typeConfig.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-slate-700">{typeConfig.label}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {event.changes.map((c) => (
                              <span key={c.ticker} className="text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-600 font-mono">
                                {c.ticker}: {c.from != null ? `${c.from.toFixed(1)}%` : '—'} → {c.to != null ? `${c.to.toFixed(1)}%` : '—'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: live snapshot */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="section-title">Live Snapshot</h2>
              {live && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Top holdings by weight · {live ? 'real-time prices' : 'simulated daily moves'}
            </p>

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
                        ${h.displayPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                    portfolioReturn1D > 0 ? 'text-green-600' : portfolioReturn1D < 0 ? 'text-red-500' : 'text-slate-500'
                  }`}>
                    {portfolioReturn1D > 0 ? '+' : ''}{portfolioReturn1D.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-500">Est. Value</span>
                  <span className="font-semibold text-slate-800">
                    ${Math.round(currentPortfolioValue).toLocaleString('en-US')}
                  </span>
                </div>
                {benchmarkReturn1D !== null && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-500">{benchmark} today</span>
                    <span className={`font-semibold ${benchmarkReturn1D > 0 ? 'text-green-600' : benchmarkReturn1D < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {benchmarkReturn1D > 0 ? '+' : ''}{benchmarkReturn1D.toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-400 mb-0.5">Wtd. Expense Ratio</p>
                    <p className="font-semibold text-gray-700">{weightedER.toFixed(3)}%</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-400 mb-0.5">Wtd. Div. Yield</p>
                    <p className="font-semibold text-green-600">{weightedYield.toFixed(2)}%</p>
                  </div>
                </div>
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

      {showRebalance && (
        <ConfirmModal
          title="Rebalance to target weights?"
          message="Entry prices will be updated to current market prices, resetting drift back to zero. A rebalance event will be logged in the weight history."
          confirmLabel="Rebalance"
          onConfirm={handleRebalance}
          onCancel={() => setShowRebalance(false)}
        />
      )}
    </div>
  );
}
