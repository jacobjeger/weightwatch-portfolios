import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#fb923c', '#22c55e', '#e11d48',
];

const RADIAN = Math.PI / 180;

function PctLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.04) return null; // skip tiny slices to avoid overlap
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600 }}
    >
      {String(name ?? '')}
    </text>
  );
}

function ActiveSlice(props) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill,
    percent, name,
  } = props;
  // Slightly expand the selected slice outward
  const expandBy = 6;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + expandBy}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#1e293b"
        strokeWidth={2}
      />
      {/* Label on the active slice */}
      {percent >= 0.04 && (() => {
        const midAngle = (startAngle + endAngle) / 2;
        const r = innerRadius + (outerRadius - innerRadius) * 0.55;
        const x = cx + r * Math.cos(-midAngle * RADIAN);
        const y = cy + r * Math.sin(-midAngle * RADIAN);
        return (
          <text
            x={x}
            y={y}
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {String(name ?? '')}
          </text>
        );
      })()}
    </g>
  );
}

/**
 * AllocationPieChart
 *
 * Props:
 *   holdings           — array of { ticker, weight_percent, ... }
 *   schwabPositions     — optional { totalValue, positions: [{ ticker, actualWeight, ... }] }
 *                        When provided, a toggle lets users switch between Target and Actual views.
 */
export default function AllocationPieChart({ holdings, schwabPositions }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [viewMode, setViewMode] = useState('target'); // 'target' | 'actual'

  if (!holdings?.length) return null;

  const hasSchwab = !!schwabPositions?.positions?.length;

  // Build data based on view mode
  const data = (() => {
    if (viewMode === 'actual' && hasSchwab) {
      // Show Schwab actual allocations — include model + unmodeled positions
      const modelTickers = new Set(holdings.map(h => h.ticker));
      const entries = [];
      // Model holdings with Schwab actual weight
      for (const h of holdings) {
        const sp = schwabPositions.positions.find(p => p.ticker === h.ticker);
        const weight = sp?.actualWeight ?? 0;
        if (weight > 0) entries.push({ name: String(h.ticker), value: parseFloat(weight.toFixed(2)) });
      }
      // Unmodeled Schwab positions
      for (const sp of schwabPositions.positions) {
        if (!modelTickers.has(sp.ticker) && sp.actualWeight > 0) {
          entries.push({ name: String(sp.ticker), value: parseFloat(sp.actualWeight.toFixed(2)) });
        }
      }
      return entries;
    }
    // Target allocation (default)
    return holdings
      .filter((h) => (Number(h.weight_percent) || 0) > 0)
      .map((h) => ({
        name: String(h.ticker || ''),
        value: parseFloat((Number(h.weight_percent) || 0).toFixed(2)),
      }));
  })();

  if (data.length === 0) return null;

  function handleClick(_, index) {
    setActiveIndex((prev) => (prev === index ? -1 : index));
  }

  return (
    <div>
      {hasSchwab && (
        <div className="flex items-center justify-center gap-1 mb-2">
          <button
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'target' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
            onClick={() => { setViewMode('target'); setActiveIndex(-1); }}
          >
            Target
          </button>
          <button
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'actual' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
            onClick={() => { setViewMode('actual'); setActiveIndex(-1); }}
          >
            Actual (Schwab)
          </button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="85%"
            dataKey="value"
            labelLine={false}
            label={activeIndex === -1 ? PctLabel : undefined}
            activeIndex={activeIndex >= 0 ? activeIndex : undefined}
            activeShape={ActiveSlice}
            onClick={handleClick}
            style={{ cursor: 'pointer', outline: 'none' }}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={viewMode === 'actual' ? PALETTE_ACTUAL[i % PALETTE_ACTUAL.length] : PALETTE[i % PALETTE.length]}
                style={{ outline: 'none' }}
              />
            ))}
          </Pie>
          <Tooltip formatter={(v, name) => [`${(Number(v) || 0).toFixed(1)}%`, String(name)]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

const PALETTE_ACTUAL = [
  '#10b981', '#059669', '#34d399', '#6ee7b7', '#047857',
  '#065f46', '#14b8a6', '#0d9488', '#2dd4bf', '#0f766e',
  '#115e59', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981',
];
