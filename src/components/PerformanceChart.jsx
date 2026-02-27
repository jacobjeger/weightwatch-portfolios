import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { getPortfolioChartData, getPortfolioDrawdownData } from '../lib/mockData';
import { isConfigured, getRealPortfolioChartData } from '../lib/finnhub';
import { BENCHMARK_META } from '../lib/mockData';

const BASE_RANGES = ['1M', '3M', '6M', '1Y', '2Y', 'Max'];
const RANGE_CALENDAR_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, 'Max': 1095 };

// Cash earns an approximate 5% annualized return (fed-funds proxy)
const CASH_DAILY_RETURN = 0.05 / 252;

const COLORS = {
  portfolio: '#3b82f6',
  benchmark: '#f59e0b',
};

function formatDate(dateStr, range) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr ?? '';
  if (range === '1M' || range === '3M' || range === '6M' || range === 'Since')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload, label, createdAt }) {
  if (!active || !payload?.length) return null;
  const isBacktested = createdAt && label < createdAt.slice(0, 10);
  return (
    <div className="bg-white border border-slate-200 rounded shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {isBacktested && (
        <p className="text-xs text-amber-600 mb-1 font-medium">Backtested (before account start)</p>
      )}
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
  // Build the range list — always add "Since" if createdAt is provided
  const ranges = useMemo(() => {
    if (createdAt) {
      return [...BASE_RANGES, 'Since'];
    }
    return BASE_RANGES;
  }, [createdAt]);

  const [range, setRange]     = useState(defaultRange ?? '1Y');
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataIsReal, setDataIsReal] = useState(false);
  const usingReal = isConfigured();

  // Clamp range to valid set when createdAt changes
  useEffect(() => {
    if (!ranges.includes(range)) setRange('1Y');
  }, [ranges]);

  // Fetch (real or mock) whenever inputs change
  useEffect(() => {
    let cancelled = false;

    // Clip chart data to only include dates >= createdAt when "Since" is selected
    function clipToCreation(series) {
      if (range !== 'Since' || !createdAt || !series.length) return series;
      const startDate = createdAt.slice(0, 10);
      const filtered = series.filter((d) => d.date >= startDate);
      if (!filtered.length) return series;
      // Re-normalize so the first point is 0% return
      const base = filtered[0];
      return filtered.map((d) => ({
        ...d,
        portfolio: parseFloat((d.portfolio - base.portfolio).toFixed(2)),
        ...(d.benchmark != null ? { benchmark: parseFloat((d.benchmark - base.benchmark).toFixed(2)) } : {}),
      }));
    }

    async function fetchData() {
      if (!holdings?.length) { setData([]); setDataIsReal(false); return; }

      // For 'Since', fetch Max then clip to createdAt
      const apiRange = range === 'Since' ? 'Max' : range;

      if (usingReal) {
        setLoading(true);
        try {
          const real = await getRealPortfolioChartData(holdings, benchmarkTicker ?? null, apiRange);
          if (!cancelled) {
            if (real.length) {
              const clipped = clipToCreation(real);
              setData(applyCashAndDrip(clipped, cashPercent, drip, clipped.length));
              setDataIsReal(true);
            } else {
              const raw = getPortfolioChartData(holdings, benchmarkTicker, range);
              const clipped = clipToCreation(raw);
              setData(applyCashAndDrip(clipped, cashPercent, drip, clipped.length));
              setDataIsReal(false);
            }
          }
        } catch {
          if (!cancelled) {
            const raw = getPortfolioChartData(holdings, benchmarkTicker, range);
            const clipped = clipToCreation(raw);
            setData(applyCashAndDrip(clipped, cashPercent, drip, clipped.length));
            setDataIsReal(false);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        const raw = getPortfolioChartData(holdings, benchmarkTicker, range);
        const clipped = clipToCreation(raw);
        setData(applyCashAndDrip(clipped, cashPercent, drip, clipped.length));
        setDataIsReal(false);
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

  // Determine the account start date for backtest/live distinction
  const accountStartDate = createdAt ? createdAt.slice(0, 10) : null;

  // Find the backtest boundary in the data
  const backtestBoundary = useMemo(() => {
    if (!accountStartDate || !data.length) return null;
    const idx = data.findIndex((d) => d.date >= accountStartDate);
    if (idx <= 0 || idx >= data.length) return null;
    return data[idx].date;
  }, [accountStartDate, data]);

  // Calculate how many days of actual history we have
  const historyDays = useMemo(() => {
    if (!createdAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
  }, [createdAt]);

  // Determine if the selected range exceeds the actual account history
  const rangeExceedsHistory = useMemo(() => {
    if (!createdAt) return true; // no creation date = everything is simulated
    if (range === 'Since') return false; // "Since creation" is always within history
    const rangeDays = RANGE_CALENDAR_DAYS[range] ?? 365;
    return rangeDays > historyDays;
  }, [createdAt, range, historyDays]);

  // Data source label — only say "Live" when data is real AND range fits within account history
  const dataSourceLabel = useMemo(() => {
    if (dataIsReal && !rangeExceedsHistory) {
      return 'Live data';
    }
    if (dataIsReal && rangeExceedsHistory) {
      return `Live data · includes backtest before account start`;
    }
    if (!createdAt) return 'Simulated data';
    if (historyDays <= 1) return `${historyDays} day of history · Simulated`;
    if (historyDays < 30) return `${historyDays} days of history · Simulated`;
    if (historyDays < 365) return `${Math.floor(historyDays / 30)}mo of history · Simulated`;
    return `${(historyDays / 365).toFixed(1)}yr of history · Simulated`;
  }, [dataIsReal, rangeExceedsHistory, createdAt, historyDays]);

  const [showDrawdown, setShowDrawdown] = useState(false);

  // Drawdown chart data (mock fallback)
  const drawdownData = useMemo(() => {
    if (!showDrawdown || !holdings?.length) return [];
    return getPortfolioDrawdownData(holdings, benchmarkTicker, range === 'Since' ? 'Max' : range);
  }, [showDrawdown, holdings, benchmarkTicker, range]);

  return (
    <div>
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-1 mb-3">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              range === r
                ? 'bg-blue-600 text-white'
                : r === 'Since'
                ? 'text-purple-600 hover:bg-purple-50 border border-purple-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {r === 'Since' ? 'Since' : r}
          </button>
        ))}
        <button
          onClick={() => setShowDrawdown(!showDrawdown)}
          className={`px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            showDrawdown
              ? 'bg-red-500 text-white'
              : 'text-slate-500 hover:bg-red-50 border border-red-200'
          }`}
          title="Toggle drawdown chart"
        >
          DD
        </button>
        <span className="ml-auto text-[10px] sm:text-xs text-slate-400 max-w-[50%] text-right truncate">
          {dataIsReal && <span className="text-green-500 mr-1">●</span>}
          {dataSourceLabel}
        </span>
      </div>

      {/* Backtest legend when chart shows a boundary */}
      {backtestBoundary && (
        <div className="flex items-center gap-4 mb-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-amber-200 rounded-sm inline-block" />
            <span className="text-slate-500">Backtested (before account start)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-blue-100 rounded-sm inline-block" />
            <span className="text-slate-500">Live (since account start)</span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="h-[220px] sm:h-[260px] flex items-center justify-center text-sm text-slate-400 animate-pulse">
          Loading chart data…
        </div>
      ) : data.length === 0 ? (
        <div className="h-[220px] sm:h-[260px] flex items-center justify-center text-sm text-slate-400">
          Add holdings to see performance
        </div>
      ) : (
        <div className="h-[220px] sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            {/* Shaded backtest region (before account start) */}
            {backtestBoundary && data.length > 0 && (
              <ReferenceArea
                x1={data[0].date}
                x2={backtestBoundary}
                fill="#fef3c7"
                fillOpacity={0.35}
                strokeOpacity={0}
              />
            )}

            {/* Vertical line at account start */}
            {backtestBoundary && (
              <ReferenceLine
                x={backtestBoundary}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Account Start',
                  position: 'top',
                  fill: '#d97706',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(v) => formatDate(v, range)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => v == null ? '' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={52}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            <Tooltip content={<CustomTooltip createdAt={createdAt} />} />
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
        </div>
      )}

      {/* Drawdown chart */}
      {showDrawdown && drawdownData.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-slate-500 mb-1 font-medium">Drawdown from Peak</div>
          <div className="h-[100px] sm:h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={drawdownData} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    if (isNaN(d.getTime())) return v ?? '';
                    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  }}
                  interval={Math.max(1, Math.floor(drawdownData.length / 5) - 1)}
                />
                <YAxis
                  tickFormatter={(v) => v == null ? '' : `${Number(v).toFixed(0)}%`}
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 0]}
                  width={40}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                <Tooltip
                  formatter={(v, name) => [`${(v ?? 0).toFixed(2)}%`, name === 'portfolio' ? 'Portfolio DD' : 'Benchmark DD']}
                  labelFormatter={(l) => {
                    const d = new Date(l);
                    return isNaN(d.getTime()) ? (l ?? '') : d.toLocaleDateString('en-US', { dateStyle: 'medium' });
                  }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  stroke="#ef4444"
                  fill="#fecaca"
                  dot={false}
                  strokeWidth={1.5}
                  name="Portfolio DD"
                />
                {hasBenchmark && drawdownData[0]?.benchmark != null && (
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    name="Benchmark DD"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
