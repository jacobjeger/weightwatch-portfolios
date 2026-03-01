import { CheckCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';

export default function PortalHeader({ portfolio, approval, syncing, handleSync, user, lastSync, portfolios, selectedIdx, setSelectedIdx, unreadCounts, setRealReturns }) {
  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 shadow-lg">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Client Portal
              </span>
              {approval && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  approval.type === 'approval'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {approval.type === 'approval' ? (
                    <><CheckCircle className="w-3 h-3" />{' '}Approved</>
                  ) : (
                    <><AlertTriangle className="w-3 h-3" />{' '}Changes Requested</>
                  )}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{portfolio?.name || 'Portfolio'}</h1>
            {portfolio?.description && (
              <p className="text-sm text-slate-400 mt-0.5">{portfolio.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              title="Sync latest changes from advisor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
            <div className="text-right text-sm hidden sm:block">
              <p className="font-medium text-slate-300">{user?.email || ''}</p>
              {lastSync instanceof Date && !isNaN(lastSync.getTime()) && (
                <p className="text-xs text-slate-500">
                  {'Last synced '}{lastSync.toLocaleTimeString()}
                </p>
              )}
              {portfolio?.created_at && !isNaN(new Date(portfolio.created_at).getTime()) && (
                <p className="text-xs text-slate-500">{'Portfolio since '}{new Date(portfolio.created_at).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio selector if multiple */}
        {portfolios.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {portfolios.map((p, i) => (
              <button
                key={p.id || i}
                onClick={() => { setSelectedIdx(i); setRealReturns(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedIdx === i
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p.name || 'Portfolio'}
                {(unreadCounts[p.id] || 0) > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCounts[p.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
