import { useState, useEffect } from 'react';
import { useAuth, getSettings, saveSettings } from '../context/AuthContext';
import { BENCHMARKS, BENCHMARK_META } from '../lib/mockData';
import { getRealPerformanceReturns, getRealHoldingsChartData, getRealRiskMetrics, isConfigured } from '../lib/finnhub';
import { useMarketData } from '../context/MarketDataContext';
import { useToast } from '../context/ToastContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const TIMEFRAMES = [
  { label: '1D',  days: 1   },
  { label: '7D',  days: 5   },
  { label: '1M',  days: 21  },
  { label: '3M',  days: 63  },
  { label: '6M',  days: 126 },
  { label: 'YTD', days: null },
  { label: '1Y',  days: 252 },
];

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];
const CHART_RANGES = ['1M', '3M', '6M', '1Y', '2Y', 'Max'];

function pctColor(v) {
  const n = parseFloat(v);
  return n > 0 ? 'text-green-600' : n < 0 ? 'text-red-500' : 'text-slate-500';
}

function PctCell({ val }) {
  if (val == null || isNaN(parseFloat(val))) {
    return <span className="font-mono font-medium text-slate-400">--</span>;
  }
  return (
    <span className={`font-mono font-medium ${pctColor(val)}`}>
      {parseFloat(val) > 0 ? '+' : ''}{parseFloat(val).toFixed(2)}%
    </span>
  );
}

export default function Benchmarks() {
  const { user } = useAuth();
  const toast    = useToast();
  const { live } = useMarketData();
  const [settings, setSettings] = useState(() => user ? getSettings(user.id) : {});
  const [chartRange, setChartRange] = useState('1Y');

  // Real benchmark returns: { SPY: { '1D': 0.45, 'YTD': ... }, ... }
  const [realBenchReturns, setRealBenchReturns] = useState({});
  const [realBenchRiskMetrics, setRealBenchRiskMetrics] = useState({});
  const [realChartData, setRealChartData]       = useState(null);

  // Fetch real returns for each benchmark ticker (in parallel)
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    Promise.all(
      BENCHMARKS.map((ticker) =>
        getRealPerformanceReturns([{ ticker, weight_percent: 100 }], null)
          .then((data) => [ticker, data?.portfolio ?? null])
          .catch(() => [ticker, null])
      )
    ).then((entries) => {
      if (cancelled) return;
      const results = {};
      for (const [ticker, data] of entries) {
        if (data) results[ticker] = data;
      }
      setRealBenchReturns(results);
    });
    return () => { cancelled = true; };
  }, [live]);

  // Fetch real risk metrics for each benchmark (in parallel)
  useEffect(() => {
    if (!isConfigured()) return;
    let cancelled = false;
    Promise.all(
      BENCHMARKS.map((ticker) =>
        getRealRiskMetrics([{ ticker, weight_percent: 100 }], null, '1Y')
          .then((data) => [ticker, data?.portfolio ?? null])
          .catch(() => [ticker, null])
      )
    ).then((entries) => {
      if (cancelled) return;
      const results = {};
      for (const [ticker, data] of entries) {
        if (data) results[ticker] = data;
      }
      setRealBenchRiskMetrics(results);
    });
    return () => { cancelled = true; };
  }, []);

  // Fetch real chart data for benchmark comparison
  useEffect(() => {
    if (!isConfigured()) return;
    let cancelled = false;
    const pseudoHoldings = BENCHMARKS.map(ticker => ({ ticker, weight_percent: 100 / BENCHMARKS.length }));
    getRealHoldingsChartData(pseudoHoldings, chartRange === 'Max' ? 'Max' : chartRange).then((data) => {
      if (!cancelled && data?.length) setRealChartData(data);
      else if (!cancelled) setRealChartData(null);
    }).catch(() => { if (!cancelled) setRealChartData(null); });
    return () => { cancelled = true; };
  }, [chartRange]);

  const hasRealReturns = Object.keys(realBenchReturns).length > 0;

  function handleSave() {
    if (user) {
      saveSettings(user.id, settings);
      toast.success('Benchmark defaults saved');
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Benchmarks</h1>

      {/* Performance table */}
      <div className="card overflow-hidden">
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100">
          <h2 className="section-title">Benchmark Performance</h2>
          <p className="text-xs text-slate-400">
            {hasRealReturns ? '● Real market data' : 'Market data unavailable'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Ticker</th>
                <th className="th">Name</th>
                {TIMEFRAMES.map((tf) => <th key={tf.label} className="th text-right">{tf.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BENCHMARKS.map((ticker) => {
                const meta = BENCHMARK_META[ticker];
                return (
                  <tr key={ticker} className="hover:bg-slate-50">
                    <td className="td">
                      <span className="font-semibold text-slate-900">{ticker}</span>
                    </td>
                    <td className="td text-slate-600">{meta?.label ?? ticker}</td>
                    {TIMEFRAMES.map((tf) => {
                      const realRet = realBenchReturns[ticker]?.[tf.label];
                      const ret = realRet != null ? realRet.toFixed(2) : null;
                      return (
                        <td key={tf.label} className="td text-right">
                          <PctCell val={ret} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Metrics table */}
      <div className="card overflow-hidden">
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100">
          <h2 className="section-title">Risk Metrics (1Y)</h2>
          <p className="text-xs text-slate-400">Annualized volatility, max drawdown, and risk-adjusted returns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Ticker</th>
                <th className="th">Name</th>
                <th className="th text-right">Volatility</th>
                <th className="th text-right">Max Drawdown</th>
                <th className="th text-right">Sharpe</th>
                <th className="th text-right">Sortino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BENCHMARKS.map((ticker) => {
                const meta = BENCHMARK_META[ticker];
                const metrics = realBenchRiskMetrics[ticker] ?? null;
                return (
                  <tr key={ticker} className="hover:bg-slate-50">
                    <td className="td">
                      <span className="font-semibold text-slate-900">{ticker}</span>
                    </td>
                    <td className="td text-slate-600">{meta?.label ?? ticker}</td>
                    <td className="td text-right">
                      <span className="font-mono font-medium text-slate-700">{metrics ? `${metrics.volatility.toFixed(1)}%` : '--'}</span>
                    </td>
                    <td className="td text-right">
                      <span className={`font-mono font-medium ${metrics && metrics.maxDrawdown < -10 ? 'text-red-500' : metrics && metrics.maxDrawdown < -5 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {metrics ? `${metrics.maxDrawdown.toFixed(1)}%` : '--'}
                      </span>
                    </td>
                    <td className="td text-right">
                      <span className={`font-mono font-medium ${metrics && metrics.sharpe > 1 ? 'text-green-600' : metrics && metrics.sharpe > 0 ? 'text-slate-700' : 'text-red-500'}`}>
                        {metrics ? metrics.sharpe.toFixed(2) : '--'}
                      </span>
                    </td>
                    <td className="td text-right">
                      <span className={`font-mono font-medium ${metrics && metrics.sortino > 1.5 ? 'text-green-600' : metrics && metrics.sortino > 0 ? 'text-slate-700' : 'text-red-500'}`}>
                        {metrics ? (metrics.sortino >= 99 ? '>99' : metrics.sortino.toFixed(2)) : '--'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">% Return Comparison</h2>
          <div className="flex items-center gap-1">
            {CHART_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  chartRange === r ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[250px] sm:h-[300px]">
        {realChartData?.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={realChartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                if (isNaN(d.getTime())) return v ?? '';
                return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              }}
              interval={Math.max(1, Math.floor(realChartData.length / 6) - 1)}
            />
            <YAxis
              tickFormatter={(v) => v == null ? '' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              width={52}
              domain={['auto', 'auto']}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            <Tooltip
              formatter={(v, name) => [`${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}%`, name]}
              labelFormatter={(l) => {
                const d = new Date(l);
                return isNaN(d.getTime()) ? (l ?? '') : d.toLocaleDateString('en-US', { dateStyle: 'medium' });
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {BENCHMARKS.map((ticker, i) => (
              <Line
                key={ticker}
                type="monotone"
                dataKey={ticker}
                stroke={CHART_COLORS[i]}
                dot={false}
                strokeWidth={2}
                name={BENCHMARK_META[ticker]?.label ?? ticker}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            {isConfigured() ? 'Loading chart data...' : 'Market data unavailable — connect Finnhub API to view charts'}
          </div>
        )}
        </div>
      </div>

      {/* Account Default Benchmarks */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Account Default Benchmarks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Primary Benchmark</label>
            <select
              className="input"
              value={settings.primary_benchmark ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, primary_benchmark: e.target.value }))}
            >
              <option value="">— None —</option>
              {BENCHMARKS.map((b) => (
                <option key={b} value={b}>{BENCHMARK_META[b]?.label ?? b}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              id="inherit"
              className="rounded border-slate-300 text-blue-600"
              checked={settings.inherit_defaults ?? true}
              onChange={(e) => setSettings((s) => ({ ...s, inherit_defaults: e.target.checked }))}
            />
            <label htmlFor="inherit" className="text-sm text-slate-700">
              New portfolios inherit account defaults
            </label>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            className="btn-secondary text-xs"
            onClick={() => setSettings((s) => ({ ...s, primary_benchmark: 'SPX', inherit_defaults: true }))}
          >
            Reset to Recommended Defaults
          </button>
          <button className="btn-primary text-xs" onClick={handleSave}>
            Save Account Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

