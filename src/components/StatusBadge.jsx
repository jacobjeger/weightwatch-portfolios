const VARIANTS = {
  'Fully Allocated':     'bg-green-100 text-green-800 ring-green-200',
  'Not Fully Allocated': 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  'No Benchmark Set':    'bg-slate-100 text-slate-600 ring-slate-200',
};

export function getPortfolioStatus(portfolio) {
  const totalWeight = (portfolio.holdings ?? []).reduce(
    (s, h) => s + (h.weight_percent ?? 0),
    0
  );
  const allocated = Math.abs(totalWeight - 100) < 0.01;
  if (!portfolio.primary_benchmark) return 'No Benchmark Set';
  return allocated ? 'Fully Allocated' : 'Not Fully Allocated';
}

export default function StatusBadge({ status }) {
  const cls = VARIANTS[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}
