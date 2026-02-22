import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getActivity, getPortfolios } from '../context/AuthContext';
import { getPortfolioReturn, getReturn } from '../lib/mockData';
import { formatDistanceToNow, format } from 'date-fns';
import { Download, ExternalLink } from 'lucide-react';

const ACTION_COLORS = {
  Create:    'bg-green-100 text-green-800',
  Update:    'bg-blue-100 text-blue-800',
  Duplicate: 'bg-purple-100 text-purple-800',
  Delete:    'bg-red-100 text-red-800',
};

const TABS = ['Activity Log', 'Performance Snapshots', 'Compare Snapshots'];

const TIMEFRAME_DAYS = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252 };

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);

  // Compare Snapshots state
  const [comparePortfolio, setComparePortfolio] = useState('');
  const [compareA, setCompareA] = useState('1M');
  const [compareB, setCompareB] = useState('1Y');

  const activity = useMemo(() => (user ? getActivity(user.id) : []), [user]);
  const portfolios = useMemo(() => (user ? getPortfolios(user.id) : []), [user]);

  // Generate mock snapshots for all portfolios
  const snapshots = useMemo(() => {
    return portfolios.flatMap((p) =>
      Object.entries(TIMEFRAME_DAYS).map(([tf, days]) => {
        const pRet = parseFloat(getPortfolioReturn(p.holdings, days));
        const bRet = p.primary_benchmark
          ? parseFloat(getReturn(p.primary_benchmark, days))
          : null;
        return {
          id: `${p.id}-${tf}`,
          portfolio_id: p.id,
          portfolio_name: p.name,
          snapshot_date: new Date().toISOString().split('T')[0],
          timeframe: tf,
          portfolio_return_pct: pRet,
          benchmark_return_pct: bRet,
          outperformance_pct: bRet !== null ? pRet - bRet : null,
          benchmark_used: p.primary_benchmark,
        };
      })
    );
  }, [portfolios]);

  const selectedPortfolio = portfolios.find((p) => p.id === comparePortfolio);

  function exportCSV() {
    const rows = [
      ['Date', 'Portfolio', 'Action', 'Summary'],
      ...activity.map((e) => [
        format(new Date(e.occurred_at), 'yyyy-MM-dd HH:mm'),
        e.portfolio_name ?? '',
        e.action_type,
        e.change_summary ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'activity-log.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">History</h1>
        {activeTab === 0 && (
          <button className="btn-secondary text-xs" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" />Export CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === i
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Activity Log */}
      {activeTab === 0 && (
        <div className="card overflow-hidden">
          {activity.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Portfolio</th>
                    <th className="th">Action</th>
                    <th className="th">Summary</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activity.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="td text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-700">
                          {format(new Date(entry.occurred_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs">
                          {format(new Date(entry.occurred_at), 'h:mm a')}
                        </div>
                      </td>
                      <td className="td font-medium text-slate-800">{entry.portfolio_name ?? '—'}</td>
                      <td className="td">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[entry.action_type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {entry.action_type}
                        </span>
                      </td>
                      <td className="td text-slate-600 text-xs max-w-sm">{entry.change_summary}</td>
                      <td className="td">
                        {entry.portfolio_id && entry.action_type !== 'Delete' && (
                          <button
                            className="text-slate-400 hover:text-blue-600"
                            onClick={() => navigate(`/portfolio/${entry.portfolio_id}`)}
                            title="Open"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Performance Snapshots */}
      {activeTab === 1 && (
        <div className="card overflow-hidden">
          {snapshots.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No portfolios to snapshot.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Portfolio</th>
                    <th className="th">Date</th>
                    <th className="th">Timeframe</th>
                    <th className="th text-right">Return</th>
                    <th className="th text-right">Benchmark</th>
                    <th className="th text-right">Alpha</th>
                    <th className="th">Benchmark Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="td font-medium text-slate-900">{s.portfolio_name}</td>
                      <td className="td text-slate-500 text-xs">{s.snapshot_date}</td>
                      <td className="td">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">{s.timeframe}</span>
                      </td>
                      <td className={`td text-right font-mono font-medium ${s.portfolio_return_pct > 0 ? 'text-green-600' : s.portfolio_return_pct < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        {s.portfolio_return_pct > 0 ? '+' : ''}{s.portfolio_return_pct.toFixed(2)}%
                      </td>
                      <td className="td text-right font-mono text-slate-500">
                        {s.benchmark_return_pct !== null ? `${s.benchmark_return_pct > 0 ? '+' : ''}${s.benchmark_return_pct.toFixed(2)}%` : '—'}
                      </td>
                      <td className={`td text-right font-mono font-medium ${
                        s.outperformance_pct === null ? 'text-slate-400'
                          : s.outperformance_pct > 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {s.outperformance_pct !== null
                          ? `${s.outperformance_pct > 0 ? '+' : ''}${s.outperformance_pct.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="td text-slate-500 text-xs">{s.benchmark_used ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Compare Snapshots */}
      {activeTab === 2 && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="section-title mb-4">Select Portfolio &amp; Timeframes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio</label>
                <select
                  className="input"
                  value={comparePortfolio}
                  onChange={(e) => setComparePortfolio(e.target.value)}
                >
                  <option value="">— Select portfolio —</option>
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timeframe A</label>
                <select className="input" value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                  {Object.keys(TIMEFRAME_DAYS).map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timeframe B</label>
                <select className="input" value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                  {Object.keys(TIMEFRAME_DAYS).map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
            </div>
          </div>

          {selectedPortfolio && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[compareA, compareB].map((tf) => {
                const days = TIMEFRAME_DAYS[tf];
                const pRet = parseFloat(getPortfolioReturn(selectedPortfolio.holdings, days));
                const bRet = selectedPortfolio.primary_benchmark
                  ? parseFloat(getReturn(selectedPortfolio.primary_benchmark, days))
                  : null;
                const alpha = bRet !== null ? pRet - bRet : null;

                return (
                  <div key={tf} className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-800">{selectedPortfolio.name}</h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm font-semibold">{tf}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-600">Portfolio Return</span>
                        <span className={`font-semibold ${pRet > 0 ? 'text-green-600' : pRet < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                          {pRet > 0 ? '+' : ''}{pRet.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-600">
                          Benchmark ({selectedPortfolio.primary_benchmark ?? 'None'})
                        </span>
                        <span className="text-slate-500 font-medium">
                          {bRet !== null ? `${bRet > 0 ? '+' : ''}${bRet.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-slate-600">Alpha</span>
                        <span className={`font-semibold ${alpha === null ? 'text-slate-400' : alpha > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {alpha !== null ? `${alpha > 0 ? '+' : ''}${alpha.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-400">Holdings: {selectedPortfolio.holdings?.length ?? 0}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Allocation: {(selectedPortfolio.holdings ?? []).reduce((s, h) => s + h.weight_percent, 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!comparePortfolio && (
            <div className="card p-12 text-center text-slate-400 text-sm">
              Select a portfolio above to compare timeframe snapshots.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

