import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { generateHistory } from '../lib/mockData';
import { isConfigured, getRealHoldingsChartData } from '../lib/finnhub';

const RANGES = ['1M', '3M', '6M', '1Y', '2Y', 'Max'];
const RANGE_DAYS = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, '2Y': 504, 'Max': 756 };

// Distinct colors for up to 15 holdings
const HOLDING_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#65a30d',
];

function formatDate(dateStr, range) {
  const d = new Date(dateStr);
  if (range === '1M' || range === '3M' || range === '6M')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function HoldingsPerformanceChart({ holdings }) {
  const [range, setRange] = useState('6M');
  const [realData, setRealData] = useState(null);
  const [loading, setLoading] = useState(false);
  const usingReal = isConfigured();

  // Track which holdings are visible (all visible by default)
  const [hiddenTickers, setHiddenTickers] = useState(new Set());

  // Reset hidden tickers when holdings change
  useEffect(() => {
    setHiddenTickers(new Set());
  }, [holdings.length]);

  const visibleHoldings = useMemo(
    () => holdings.filter((h) => !hiddenTickers.has(h.ticker)),
    [holdings, hiddenTickers]
  );

  function toggleTicker(ticker) {
    setHiddenTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  function showAll() {
    setHiddenTickers(new Set());
  }

  function hideAll() {
    setHiddenTickers(new Set(holdings.map((h) => h.ticker)));
  }

  // Fetch real data when available
  useEffect(() => {
    if (!usingReal || !holdings?.length) return;
    let cancelled = false;
    setLoading(true);
    getRealHoldingsChartData(holdings, range).then((data) => {
      if (!cancelled && data?.length) setRealData(data);
      else if (!cancelled) setRealData(null);
    }).catch(() => {
      if (!cancelled) setRealData(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [holdings, range, usingReal]);

  // Fall back to mock data if no real data
  const chartData = useMemo(() => {
    if (realData?.length) return realData;
    if (!holdings?.length) return [];
    const numDays = RANGE_DAYS[range] ?? 126;

    const histories = holdings.map((h) => ({
      ticker: h.ticker,
      data: generateHistory(h.ticker, numDays),
    }));

    const dates = histories[0].data.map((d) => d.date);

    return dates.map((date, i) => {
      const entry = { date };
      histories.forEach((h) => {
        const startPrice = h.data[0]?.price ?? 1;
        const currentPrice = h.data[i]?.price ?? startPrice;
        entry[h.ticker] = parseFloat(((currentPrice / startPrice - 1) * 100).toFixed(2));
      });
      return entry;
    });
  }, [holdings, range, realData]);

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));
  const ticks = chartData
    .filter((_, i) => i % tickInterval === 0 || i === chartData.length - 1)
    .map((d) => d.date);

  if (!holdings?.length) return null;

  return (
    <div>
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              range === r
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {r}
          </button>
        ))}
        <span className="ml-auto text-[10px] sm:text-xs text-slate-400">
          {loading ? 'Loading...' : realData ? '● Live' : 'Simulated'}
        </span>
      </div>

      {/* Holdings toggle chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-slate-400 mr-1">Show:</span>
        {holdings.map((h, i) => {
          const isVisible = !hiddenTickers.has(h.ticker);
          const color = HOLDING_COLORS[i % HOLDING_COLORS.length];
          return (
            <button
              key={h.ticker}
              onClick={() => toggleTicker(h.ticker)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
                isVisible
                  ? 'border-transparent text-white'
                  : 'border-slate-200 text-slate-400 bg-white'
              }`}
              style={isVisible ? { backgroundColor: color } : {}}
            >
              {h.ticker}
            </button>
          );
        })}
        {holdings.length > 2 && (
          <span className="ml-1 flex items-center gap-1">
            <button onClick={showAll} className="text-xs text-blue-500 hover:underline">All</button>
            <span className="text-slate-300">|</span>
            <button onClick={hideAll} className="text-xs text-blue-500 hover:underline">None</button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-[240px] sm:h-[300px] flex items-center justify-center text-sm text-slate-400 animate-pulse">
          Loading real market data…
        </div>
      ) : visibleHoldings.length === 0 ? (
        <div className="h-[240px] sm:h-[300px] flex items-center justify-center text-sm text-slate-400">
          Select holdings above to compare
        </div>
      ) : (
        <div className="h-[240px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
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
            <Tooltip
              formatter={(v, name) => [`${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`, name]}
              labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {holdings.map((h, i) => {
              const isVisible = !hiddenTickers.has(h.ticker);
              if (!isVisible) return null;
              return (
                <Line
                  key={h.ticker}
                  type="monotone"
                  dataKey={h.ticker}
                  stroke={HOLDING_COLORS[i % HOLDING_COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  name={`${h.ticker} (${h.weight_percent.toFixed(1)}%)`}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
