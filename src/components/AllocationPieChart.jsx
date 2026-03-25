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

export default function AllocationPieChart({ holdings }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  if (!holdings?.length) return null;
  const data = holdings
    .filter((h) => (Number(h.weight_percent) || 0) > 0)
    .map((h) => ({
      name: String(h.ticker || ''),
      value: parseFloat((Number(h.weight_percent) || 0).toFixed(2)),
    }));

  if (data.length === 0) return null;

  function handleClick(_, index) {
    setActiveIndex((prev) => (prev === index ? -1 : index));
  }

  return (
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
              fill={PALETTE[i % PALETTE.length]}
              style={{ outline: 'none' }}
            />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [`${(Number(v) || 0).toFixed(1)}%`, String(name)]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
