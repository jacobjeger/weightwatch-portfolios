import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, RefreshCw, ChevronDown, ChevronRight, ExternalLink, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorLogs, deleteErrorLog, clearAllErrorLogs } from '../lib/errorLogger';
import ConfirmModal from '../components/ConfirmModal';

const SOURCE_COLORS = {
  react: 'bg-red-100 text-red-700',
  unhandled: 'bg-orange-100 text-orange-700',
  promise: 'bg-amber-100 text-amber-700',
  console: 'bg-slate-100 text-slate-600',
  network: 'bg-blue-100 text-blue-700',
  manual: 'bg-purple-100 text-purple-700',
};

const LEVEL_COLORS = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-blue-500',
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

function ErrorRow({ log, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const count = log.occurrence_count || 1;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        )}

        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${LEVEL_COLORS[log.level] || LEVEL_COLORS.error}`} />

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
            <span className="text-[11px] text-slate-400">
              {timeAgo(log.last_seen_at || log.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-800 font-mono mt-1 truncate">
            {log.message}
          </p>
        </div>

        <button
          className="text-slate-300 hover:text-red-500 p-1 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
          title="Delete this error"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 bg-slate-50/50">
          {/* Full message */}
          <div className="pt-3">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Message</label>
            <p className="text-sm text-slate-800 font-mono mt-1 whitespace-pre-wrap break-words">
              {log.message}
            </p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">First Seen</label>
              <p className="text-slate-600 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Last Seen</label>
              <p className="text-slate-600 mt-0.5">{new Date(log.last_seen_at || log.created_at).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Occurrences</label>
              <p className="text-slate-600 mt-0.5 font-semibold">{count}</p>
            </div>
            {log.user_id && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">User ID</label>
                <p className="text-slate-600 mt-0.5 font-mono truncate">{log.user_id}</p>
              </div>
            )}
          </div>

          {/* URL */}
          {log.url && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">URL</label>
              <p className="text-xs text-blue-600 mt-0.5 truncate">{log.url}</p>
            </div>
          )}

          {/* Stack trace */}
          {log.stack && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Stack Trace</label>
              <pre className="mt-1 p-3 bg-slate-900 text-green-400 text-[11px] rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                {log.stack}
              </pre>
            </div>
          )}

          {/* Component stack */}
          {log.component && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">React Component Stack</label>
              <pre className="mt-1 p-3 bg-blue-950 text-blue-300 text-[11px] rounded-lg overflow-x-auto max-h-40 whitespace-pre-wrap break-words">
                {log.component}
              </pre>
            </div>
          )}

          {/* User agent */}
          {log.user_agent && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">User Agent</label>
              <p className="text-[11px] text-slate-400 mt-0.5 break-all">{log.user_agent}</p>
            </div>
          )}

          {/* Raw metadata */}
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

export default function ErrorLogs() {
  const { user, role } = useAuth();
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterSource, setFilterSource] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showClearAll, setShowClearAll] = useState(false);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await getErrorLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        source: filterSource || undefined,
        level: filterLevel || undefined,
      });
      setLogs(data);
      setTotalCount(count);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filterSource, filterLevel]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handleDelete(id) {
    await deleteErrorLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
    setTotalCount(c => c - 1);
  }

  async function handleClearAll() {
    await clearAllErrorLogs();
    setLogs([]);
    setTotalCount(0);
    setShowClearAll(false);
  }

  if (role !== 'advisor') {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-700">Access Denied</h1>
        <p className="text-slate-500 mt-2">Error logs are only accessible to advisors.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const errorCount = logs.reduce((s, l) => s + (l.occurrence_count || 1), 0);

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Error Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalCount} unique errors ({errorCount} total occurrences)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 text-xs"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {logs.length > 0 && (
            <button
              className="btn-danger flex items-center gap-1.5 text-xs"
              onClick={() => setShowClearAll(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="input text-xs py-1.5 w-32"
          value={filterSource}
          onChange={e => { setFilterSource(e.target.value); setPage(0); }}
        >
          <option value="">All Sources</option>
          <option value="react">React</option>
          <option value="unhandled">Unhandled</option>
          <option value="promise">Promise</option>
          <option value="console">Console</option>
          <option value="network">Network</option>
          <option value="manual">Manual</option>
        </select>
        <select
          className="input text-xs py-1.5 w-32"
          value={filterLevel}
          onChange={e => { setFilterLevel(e.target.value); setPage(0); }}
        >
          <option value="">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Error list */}
      {loading && !logs.length ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No errors</h3>
          <p className="text-sm text-slate-500 mt-1">Everything is running smoothly.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <ErrorRow key={log.id} log={log} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            className="btn-secondary text-xs"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="btn-secondary text-xs"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}

      <ConfirmModal
        open={showClearAll}
        title="Clear All Error Logs"
        message="This will permanently delete all error log entries. This action cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearAll(false)}
      />
    </div>
  );
}
