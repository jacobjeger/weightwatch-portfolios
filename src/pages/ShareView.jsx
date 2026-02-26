import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedPortfolio } from '../context/AuthContext';
import AllocationPieChart from '../components/AllocationPieChart';
import PerformanceChart from '../components/PerformanceChart';

export default function ShareView() {
  const { token } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getSharedPortfolio(token).then((p) => {
      if (!p) setNotFound(true);
      else setPortfolio(p);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-500 text-sm">Loading portfolio…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <div className="text-2xl">🔗</div>
        <h1 className="text-lg font-semibold text-slate-700">Link not found</h1>
        <p className="text-sm text-slate-500">This share link is invalid or has expired.</p>
      </div>
    );
  }

  const sharedDate = portfolio._sharedAt
    ? new Date(portfolio._sharedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
            AJA Wealth Management
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-sm text-slate-500 mt-1">{portfolio.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
              Read-only view
            </span>
            {sharedDate && (
              <span className="text-xs text-slate-400">Shared {sharedDate}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Holdings table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Holdings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">
                    Ticker
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">
                    Name
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">
                    Role
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">
                    Target %
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h) => (
                  <tr key={h.ticker} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-mono font-semibold text-slate-800">
                      {h.ticker}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{h.name}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          (h.category || 'Core') === 'Core'
                            ? 'bg-blue-50 text-blue-700'
                            : (h.category || 'Core') === 'Tilt'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {h.category || 'Core'}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-slate-700">
                      {(h.weight_percent || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two-column: pie chart + allocation breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Allocation Wheel</h2>
            <AllocationPieChart holdings={portfolio.holdings} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Allocation Breakdown</h2>
            {(() => {
              const CATS = ['Core', 'Tilt', 'Satellite'];
              const CAT_COLORS = {
                Core: 'bg-blue-500',
                Tilt: 'bg-violet-500',
                Satellite: 'bg-amber-500',
              };
              return CATS.map((cat) => {
                const w = portfolio.holdings
                  .filter((h) => (h.category || 'Core') === cat)
                  .reduce((s, h) => s + (h.weight_percent || 0), 0);
                if (w === 0) return null;
                return (
                  <div key={cat} className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-slate-500 w-16">{cat}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className={`${CAT_COLORS[cat]} h-2 rounded-full`}
                        style={{ width: `${Math.min(w, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-700 w-10 text-right">
                      {w.toFixed(1)}%
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Performance chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Performance</h2>
          <PerformanceChart
            holdings={portfolio.holdings}
            benchmarkTicker={portfolio.primary_benchmark || null}
            createdAt={portfolio.created_at}
            cashPercent={0}
            drip={false}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Powered by{' '}
          <span className="font-semibold text-blue-600">AJA Wealth Management</span>
        </p>
      </main>
    </div>
  );
}
