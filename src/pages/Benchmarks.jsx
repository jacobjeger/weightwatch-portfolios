import { useState } from 'react';
import { useAuth, getSettings, saveSettings } from '../context/AuthContext';
import { INSTRUMENTS, BENCHMARKS, BENCHMARK_META, getReturn, getYTDReturn } from '../lib/mockData';
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
const CHART_RANGES = ['1M', '3M', '6M', '1Y', 'Max'];

function pctColor(v) {
  const n = parseFloat(v);
  return n > 0 ? 'text-green-600' : n < 0 ? 'text-red-500' : 'text-slate-500';
}

function PctCell({ val }) {
  return (
    <span className={`font-mono font-medium ${pctColor(val)}`}>
      {parseFloat(val) > 0 ? '+' : ''}{parseFloat(val).toFixed(2)}%
    </span>
  );
}

export default function Benchmarks() {
  const { user } = useAuth();
  const toast    = useToast();
  const [settings, setSettings] = useState(() => user ? getSettings(user.id) : {});
  const [chartRange, setChartRange] = useState('1Y');

  // Build multi-line chart data for all 6 benchmarks
  const multiChartData = (() => {
    const RANGE_DAYS = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, 'Max': 504 };
    const numDays = RANGE_DAYS[chartRange] ?? 252;

    // Import at top level won't work in closure, so we inline the logic
    // using the pre-imported functions
    const histories = BENCHMARKS.map((t) => {
      // Indices (^ prefix) don't have an INSTRUMENTS entry — just use 100 as base
      const inst = INSTRUMENTS.find((i) => i.ticker === t);
      const currentPrice = inst?.last_price ?? 100;
      const prices = generateMockHistory(t, currentPrice, numDays);
      return { ticker: t, prices };
    });

    if (!histories[0]) return [];
    const dates = generateTradingDates(numDays);

    return dates.map((date, i) => {
      const entry = { date };
      histories.forEach((h) => {
        // Return % change from start (0 = flat, positive = gain)
        entry[h.ticker] = parseFloat(((h.prices[i] / h.prices[0] - 1) * 100).toFixed(2));
      });
      return entry;
    });
  })();

  function handleSave() {
    if (user) {
      saveSettings(user.id, settings);
      toast.success('Benchmark defaults saved');
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Benchmarks</h1>

      {/* Performance table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="section-title">Benchmark Performance</h2>
          <p className="text-xs text-slate-400">Simulated returns — not real market data</p>
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
                const inst = INSTRUMENTS.find((i) => i.ticker === ticker);
                return (
                  <tr key={ticker} className="hover:bg-slate-50">
                    <td className="td">
                      <span className="font-semibold text-slate-900">{ticker}</span>
                    </td>
                    <td className="td text-slate-600">{meta?.label ?? inst?.name ?? ticker}</td>
                    {TIMEFRAMES.map((tf) => {
                      const ret = tf.label === 'YTD' ? getYTDReturn(ticker) : getReturn(ticker, tf.days);
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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={multiChartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              }}
              interval={Math.max(1, Math.floor(multiChartData.length / 6) - 1)}
            />
            <YAxis
              tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              width={52}
              domain={['auto', 'auto']}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            <Tooltip
              formatter={(v, name) => [`${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`, name]}
              labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { dateStyle: 'medium' })}
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
      </div>

      {/* Account Default Benchmarks */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Account Default Benchmarks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Primary Benchmark</label>
            <select
              className="input"
              value={settings.primary_benchmark ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, primary_benchmark: e.target.value }))}
            >
              <option value="">— None —</option>
              {BENCHMARKS.map((b) => (
                <option key={b} value={b}>{BENCHMARK_META[b]?.label ?? b} ({b})</option>
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
            onClick={() => setSettings((s) => ({ ...s, primary_benchmark: '^GSPC', inherit_defaults: true }))}
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

// ─── Inline helpers (mirrors mockData.js logic without import overhead) ────────
function seedRand(seed) {
  let s = Math.abs(seed) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function tickerHash(t) {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) & 0x7fffffff;
  return h;
}
function generateMockHistory(ticker, currentPrice, numDays) {
  const isIndex = ticker.startsWith('^');
  const vol = isIndex || ['SPY','QQQ','IWM','EFA','ACWI','AGG','VOO','VTI','BND','TLT','DIA','EEM','HYG','LQD','TIPS','SLV'].includes(ticker) ? 0.007 : 0.016;
  const drift = 0.00035;
  const rand = seedRand(tickerHash(ticker));
  const returns = Array.from({ length: numDays - 1 }, () => {
    const u1 = Math.max(rand(), 1e-9), u2 = rand();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return drift + vol * n;
  });
  const prices = [currentPrice];
  for (let i = returns.length - 1; i >= 0; i--) prices.unshift(prices[0] / (1 + returns[i]));
  return prices;
}
function generateTradingDates(numDays) {
  const dates = [];
  let d = new Date();
  while (dates.length < numDays) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dates.unshift(d.toISOString().split('T')[0]);
    d = new Date(d.getTime() - 86400000);
  }
  return dates;
}
