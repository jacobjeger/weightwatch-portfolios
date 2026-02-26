import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

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
      {name}
    </text>
  );
}

export default function AllocationPieChart({ holdings }) {
  const data = holdings
    .filter((h) => (h.weight_percent || 0) > 0)
    .map((h) => ({
      name: h.ticker,
      value: parseFloat((h.weight_percent).toFixed(2)),
    }));

  if (data.length === 0) return null;

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
          label={PctLabel}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [`${v.toFixed(1)}%`, name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
