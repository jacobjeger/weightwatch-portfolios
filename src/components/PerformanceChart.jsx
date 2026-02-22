import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getPortfolioChartData } from '../lib/mockData';
import { isConfigured, getRealPortfolioChartData } from '../lib/finnhub';
import { BENCHMARK_META } from '../lib/mockData';

const BASE_RANGES = ['1M', '3M', '6M', '1Y', 'Max'];

// Cash earns an approximate 5% annualized return (fed-funds proxy)
const CASH_DAILY_RETURN = 0.05 / 252;

const COLORS = {
  portfolio: '#3b82f6',
  benchmark: '#f59e0b',
};

function formatDate(dateStr, range) {
  const d = new Date(dateStr);
  if (range === '1M' || range === '3M' || range === '6M' || range === 'Since')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          <span className="text-slate-600 capitalize">{p.name ?? p.dataKey}:</span>
          <span className="font-semibold" style={{ color: p.color }}>
            {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// Apply cash + DRIP drag to already-computed % return series
function applyCashAndDrip(series, cashPercent, drip, numPoints) {
  if (!cashPercent && drip) return series; // no adjustment needed
  const investedFraction = (100 - cashPercent) / 100;
  // Daily compounded cash return over the range
  const cashReturnPct = (Math.pow(1 + CASH_DAILY_RETURN, numPoints) - 1) * 100;
  // DRIP-off drag: approximate 1.5% annualized dividend yield, prorated
  const dripDrag = drip ? 0 : -(1.5 / 252) * numPoints;

  return series.map((point) => ({
    ...point,
    portfolio: parseFloat(
      (point.portfolio * investedFraction + cashReturnPct * (cashPercent / 100) + dripDrag)
        .toFixed(2)
    ),
  }));
}

export default function PerformanceChart({
  holdings,
  benchmarkTicker,
  defaultRange,
  createdAt,
  cashPercent = 0,
  drip = true,
}) {
  // Build the range list — add "Since" if createdAt is provided
  const ranges = useMemo(() => {
    if (createdAt) {
      const msAge = Date.now() - new Date(createdAt).getTime();
      // Only show "Since" if portfolio is older than 1 day and younger than Max
      if (msAge > 86_400_000) return [...BASE_RANGES, 'Since'];
    }
    return BASE_RANGES;
  }, [createdAt]);

  const [range, setRange]     = useState(defaultRange ?? '1Y');
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const usingReal = isConfigured();

  // Clamp range to valid set when createdAt changes
  useEffect(() => {
    if (!ranges.includes(range)) setRange('1Y');
  }, [ranges]);

  // Compute numDays for "Since" range
  const numDays = useMemo(() => {
    if (range === 'Since' && createdAt) {
      const msAge = Date.now() - new Date(createdAt).getTime();
      return Math.max(2, Math.ceil(msAge / 86_400_000 * (252 / 365)));
    }
    const MAP = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, 'Max': 504 };
    return MAP[range] ?? 252;
  }, [range, createdAt]);

  // Fetch (real or mock) whenever inputs change
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!holdings?.length) { setData([]); return; }

      // Map 'Since' to equivalent API range string
      const apiRange = range === 'Since' ? 'Max' : range;

      if (usingReal) {
        setLoading(true);
        try {
          const real = await getRealPortfolioChartData(holdings, benchmarkTicker ?? null, apiRange);
          if (!cancelled) {
            const raw = real.length ? real : getPortfolioChartData(holdings, benchmarkTicker, range);
            setData(applyCashAndDrip(raw, cashPercent, drip, raw.length));
          }
        } catch {
          if (!cancelled) {
            const raw = getPortfolioChartData(holdings, benchmarkTicker, range);
            setData(applyCashAndDrip(raw, cashPercent, drip, raw.length));
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        const raw = getPortfolioChartData(holdings, benchmarkTicker, range);
        setData(applyCashAndDrip(raw, cashPercent, drip, raw.length));
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [holdings, benchmarkTicker, range, usingReal, cashPercent, drip]);

  // Thin out X-axis ticks
  const tickInterval = Math.max(1, Math.floor(data.length / 8));
  const ticks = data
    .filter((_, i) => i % tickInterval === 0 || i === data.length - 1)
    .map((d) => d.date);

  const hasPortfolio = holdings && holdings.length > 0;
  const hasBenchmark = !!benchmarkTicker;
  const benchLabel   = BENCHMARK_META[benchmarkTicker]?.label ?? benchmarkTicker;

  return (
    <div>
      {/* Range selector */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              range === r
                ? 'bg-blue-600 text-white'
                : r === 'Since'
                ? 'text-purple-600 hover:bg-purple-50 border border-purple-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {r === 'Since' ? 'Since Creation' : r}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {usingReal ? '🟢 Live · ' : ''}% return from start
        </span>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-slate-400 animate-pulse">
          Loading chart data…
        </div>
      ) : data.length === 0 ? (
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
              tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={52}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(v) => v}
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
                name={benchLabel ?? benchmarkTicker}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
