import { useState, useEffect, useCallback } from 'react';
import { Terminal, ChevronDown, ChevronRight, RefreshCw, Search, XCircle } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';

// ── Shared helpers ──────────────────────────────────────────────────────────

const SOURCE_COLORS = {
  react: 'bg-red-100 text-red-700',
  unhandled: 'bg-orange-100 text-orange-700',
  promise: 'bg-amber-100 text-amber-700',
  console: 'bg-slate-100 text-slate-600',
  network: 'bg-blue-100 text-blue-700',
  manual: 'bg-purple-100 text-purple-700',
  schwab: 'bg-emerald-100 text-emerald-700',
};
const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#64748b', '#3b82f6', '#a855f7'];
const LEVEL_DOTS = { error: 'bg-red-500', warn: 'bg-amber-500', info: 'bg-blue-500' };
const ACTION_COLORS = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  duplicate: 'bg-purple-100 text-purple-700',
  delete: 'bg-red-100 text-red-700',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function apiFetch(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`/api/dev-dashboard?${qs}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Tab Components ──────────────────────────────────────────────────────────

function ErrorRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const count = log.occurrence_count || 1;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />}
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${LEVEL_DOTS[log.level] || LEVEL_DOTS.error}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${SOURCE_COLORS[log.source] || SOURCE_COLORS.manual}`}>
              {log.source}
            </span>
            {count > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-bold">
                {count}x
              </span>
            )}
            <span className="text-[11px] text-slate-400">{timeAgo(log.last_seen_at || log.created_at)}</span>
          </div>
          <p className="text-sm text-slate-800 font-mono mt-1 truncate">{log.message}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 bg-slate-50/50">
          <div className="pt-3">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Message</label>
            <p className="text-sm text-slate-800 font-mono mt-1 whitespace-pre-wrap break-words">{log.message}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Level</label>
              <p className="text-slate-600 mt-0.5 capitalize">{log.level}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Source</label>
              <p className="text-slate-600 mt-0.5">{log.source}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Occurrences</label>
              <p className="text-slate-600 mt-0.5 font-semibold">{count}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">User</label>
              <p className="text-slate-600 mt-0.5 truncate">{log.profiles?.email || log.user_id || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">First Seen</label>
              <p className="text-slate-600 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Last Seen</label>
              <p className="text-slate-600 mt-0.5">{new Date(log.last_seen_at || log.created_at).toLocaleString()}</p>
            </div>
          </div>

          {log.url && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">URL</label>
              <p className="text-xs text-blue-600 mt-0.5 truncate">{log.url}</p>
            </div>
          )}

          {log.stack && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Stack Trace</label>
              <pre className="mt-1 p-3 bg-slate-900 text-green-400 text-[11px] rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                {log.stack}
              </pre>
            </div>
          )}

          {log.component && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">React Component Stack</label>
              <pre className="mt-1 p-3 bg-blue-950 text-blue-300 text-[11px] rounded-lg overflow-x-auto max-h-40 whitespace-pre-wrap break-words">
                {log.component}
              </pre>
            </div>
          )}

          {log.user_agent && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">User Agent</label>
              <p className="text-[11px] text-slate-400 mt-0.5 break-all">{log.user_agent}</p>
            </div>
          )}

          {log.metadata && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Metadata</label>
              <pre className="mt-1 p-3 bg-slate-100 text-slate-700 text-[11px] rounded-lg overflow-x-auto">
                {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Error Logs Tab ──────────────────────────────────────────────────────────

function ErrorsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [source, setSource] = useState('');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch('error-logs', {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(source && { source }),
        ...(level && { level }),
        ...(search && { search }),
      });
      setData(result);
    } catch (err) {
      console.error('[DevDashboard] Error logs fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, source, level, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;
  const totalOccurrences = (data?.topErrors || []).reduce((s, e) => s + (e.occurrence_count || 1), 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const errorsToday = (data?.dailyCounts || []).find(d => d.date === todayStr)?.count || 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Unique Errors', value: data?.count ?? '—' },
          { label: 'Errors Today', value: errorsToday },
          { label: 'Total Occurrences', value: totalOccurrences || '—' },
          { label: 'Sources', value: data?.sourceCounts?.length ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">{c.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {data && (data.dailyCounts?.length > 0 || data.sourceCounts?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.dailyCounts?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Errors per Day (30d)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.dailyCounts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip labelFormatter={d => d} />
                  <Bar dataKey="count" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.sourceCounts?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">By Source</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.sourceCounts} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label={({ source, count }) => `${source} (${count})`}>
                    {data.sourceCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Top errors */}
      {data?.topErrors?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Top Errors by Frequency</h3>
          <div className="divide-y divide-slate-100">
            {data.topErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${SOURCE_COLORS[e.source] || SOURCE_COLORS.manual}`}>
                  {e.source}
                </span>
                <span className="flex-1 truncate font-mono text-slate-700 text-xs">{e.message}</span>
                <span className="text-xs font-bold text-red-600">{e.occurrence_count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={source} onChange={e => { setSource(e.target.value); setPage(0); }} className="input text-xs py-1.5">
          <option value="">All Sources</option>
          {['react', 'unhandled', 'promise', 'console', 'network', 'manual', 'schwab'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={level} onChange={e => { setLevel(e.target.value); setPage(0); }} className="input text-xs py-1.5">
          <option value="">All Levels</option>
          {['error', 'warn', 'info'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Search messages..."
            className="input text-xs py-1.5 w-48"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(0); } }}
          />
          <button className="btn-secondary text-xs px-2 py-1.5" onClick={() => { setSearch(searchInput); setPage(0); }}>
            <Search className="w-3.5 h-3.5" />
          </button>
          {search && (
            <button className="text-slate-400 hover:text-slate-600" onClick={() => { setSearch(''); setSearchInput(''); setPage(0); }}>
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
        <button className="btn-secondary text-xs px-2 py-1.5 ml-auto" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error list */}
      {loading && !data ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {(data?.logs || []).map(log => <ErrorRow key={log.id} log={log} />)}
          {data?.logs?.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No errors found</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button className="btn-secondary text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button className="btn-secondary text-xs" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next</button>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('users').then(d => setUsers(d.users)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Email', 'Role', 'Created', 'Portfolios', 'Schwab'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(users || []).map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    u.role === 'client' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{timeAgo(u.created_at)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-700 font-semibold">{u.portfolio_count}</td>
                <td className="px-4 py-2.5 text-xs">
                  {u.schwab_linked
                    ? <span className="text-emerald-600 font-semibold">Linked</span>
                    : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(!users || users.length === 0) && (
        <div className="text-center py-12 text-slate-400 text-sm">No users found</div>
      )}
    </div>
  );
}

// ── Schwab Tokens Tab ───────────────────────────────────────────────────────

function SchwabTab() {
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('schwab-tokens').then(d => setTokens(d.tokens)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>;

  function tokenStatus(expiresAt) {
    if (!expiresAt) return { label: 'Unknown', cls: 'bg-slate-100 text-slate-500', row: '' };
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    if (exp < now) return { label: 'Expired', cls: 'bg-red-100 text-red-700', row: 'bg-red-50' };
    if (exp < now + 30 * 60000) return { label: 'Expiring Soon', cls: 'bg-amber-100 text-amber-700', row: 'bg-amber-50' };
    return { label: 'Valid', cls: 'bg-emerald-100 text-emerald-700', row: '' };
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['User', 'Linked', 'Expires', 'Status', 'Last Updated', 'Accounts'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(tokens || []).map(t => {
              const status = tokenStatus(t.expires_at);
              return (
                <tr key={t.user_id} className={`hover:bg-slate-50 ${status.row}`}>
                  <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{t.email}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{t.linked_at ? new Date(t.linked_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{t.expires_at ? new Date(t.expires_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{timeAgo(t.updated_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{Array.isArray(t.schwab_accounts) ? t.schwab_accounts.length : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(!tokens || tokens.length === 0) && (
        <div className="text-center py-12 text-slate-400 text-sm">No Schwab tokens found</div>
      )}
    </div>
  );
}

// ── Activity Log Tab ────────────────────────────────────────────────────────

function ActivityTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const PAGE_SIZE = 100;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch('activity-log', {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(filterUser && { user_id: filterUser }),
        ...(filterAction && { action_type: filterAction }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      });
      setData(result);
    } catch (err) {
      console.error('[DevDashboard] Activity fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterAction, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }} className="input text-xs py-1.5">
          <option value="">All Users</option>
          {(data?.users || []).map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }} className="input text-xs py-1.5">
          <option value="">All Actions</option>
          {(data?.actionTypes || []).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="input text-xs py-1.5" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="input text-xs py-1.5" />
        <button className="btn-secondary text-xs px-2 py-1.5" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['User', 'Action', 'Portfolio', 'Summary', 'Time'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.logs || []).map((log, i) => (
                <tr key={log.id || i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs text-slate-700 font-mono">{log.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      ACTION_COLORS[log.action_type?.toLowerCase()] || 'bg-slate-100 text-slate-600'
                    }`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">{log.portfolio_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{log.change_summary || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{timeAgo(log.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.logs?.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No activity found</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button className="btn-secondary text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button className="btn-secondary text-xs" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next</button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'errors', label: 'Error Logs' },
  { key: 'users', label: 'Users' },
  { key: 'schwab', label: 'Schwab Tokens' },
  { key: 'activity', label: 'Activity Log' },
];

export default function DevDashboard() {
  const [activeTab, setActiveTab] = useState('errors');

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-slate-900">
          <Terminal className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dev Dashboard</h1>
          <p className="text-xs text-slate-400">System monitoring and diagnostics</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-0 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'errors' && <ErrorsTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'schwab' && <SchwabTab />}
      {activeTab === 'activity' && <ActivityTab />}
    </div>
  );
}
