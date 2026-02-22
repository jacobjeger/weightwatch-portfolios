import { useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getPortfolioChartData } from '../lib/mockData';

const RANGES = ['1M', '3M', '6M', '1Y', 'Max'];

const COLORS = {
  portfolio:  '#3b82f6',
  benchmark:  '#f59e0b',
};

function formatDate(dateStr, range) {
  const d = new Date(dateStr);
  if (range === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (range === '3M' || range === '6M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600 capitalize">{p.dataKey}:</span>
          <span className="font-semibold" style={{ color: p.color }}>
            {p.value?.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PerformanceChart({ holdings, benchmarkTicker, defaultRange }) {
  const [range, setRange] = useState(defaultRange ?? '1Y');

  const data = getPortfolioChartData(holdings, benchmarkTicker, range);

  // Thin out X-axis ticks
  const tickInterval = Math.max(1, Math.floor(data.length / 8));
  const ticks = data
    .filter((_, i) => i % tickInterval === 0 || i === data.length - 1)
    .map((d) => d.date);

  const hasPortfolio = holdings && holdings.length > 0;
  const hasBenchmark = !!benchmarkTicker;

  return (
    <div>
      {/* Range selector */}
      <div className="flex items-center gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              range === r
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {r}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">Normalized to 100</span>
      </div>

      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-slate-400">
          Add holdings to see performance
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(v) => formatDate(v, range)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => v.toFixed(0)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={40}
            />
            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 2" />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
            />
            {hasPortfolio && (
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke={COLORS.portfolio}
                dot={false}
                strokeWidth={2}
                name="Portfolio"
              />
            )}
            {hasBenchmark && (
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={COLORS.benchmark}
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                name={`Benchmark (${benchmarkTicker})`}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
