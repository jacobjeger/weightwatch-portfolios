import { useState } from 'react';
import { BarChart3, MessageCircle, CheckCircle, AlertTriangle, Shield, Eye, TrendingUp, TrendingDown, ChevronDown, PieChart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SectionErrorBoundary } from '../components/ErrorBoundary';
import { useClientPortfolio } from '../hooks/useClientPortfolio';
import PortalHeader from '../components/PortalHeader';
import PerformanceChart from '../components/PerformanceChart';
import HoldingsPerformanceChart from '../components/HoldingsPerformanceChart';
import AllocationPieChart from '../components/AllocationPieChart';
import MessagePanel from '../components/MessagePanel';

function CollapsibleSection({ title, icon, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {badge}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

export default function ClientPortal() {
  return (
    <SectionErrorBoundary label="Client Portal">
      <ClientPortalBody />
    </SectionErrorBoundary>
  );
}

function ClientPortalBody() {
  const { user, role, refreshClientPortfolios } = useAuth();
  const {
    portfolios, portfolio, selectedIdx, setSelectedIdx,
    holdings, approval, benchmark, benchLabel,
    syncing, lastSync, unreadCounts, realReturns, setRealReturns,
    currentWeights, ytdReturn, sinceReturn, oneYearReturn, benchYtd,
    currentPortfolioValue, totalWeight, cashPercent,
    live, prices, handleSync,
  } = useClientPortfolio(user, role, refreshClientPortfolios);

  if (!user || role !== 'client') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">Client Portal</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            This portal is available for invited clients. Please use an invite link from your advisor to access your portfolio.
          </p>
        </div>
      </div>
    );
  }

  if (!portfolios.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">Welcome to Your Portal</h1>
          <p className="text-slate-500 mb-4">No portfolios have been shared with you yet.</p>
          <p className="text-sm text-slate-400">Ask your advisor for an invite link to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <SectionErrorBoundary label="Header">
        <PortalHeader
          portfolio={portfolio}
          approval={approval}
          syncing={syncing}
          handleSync={handleSync}
          user={user}
          lastSync={lastSync}
          portfolios={portfolios}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          unreadCounts={unreadCounts}
          setRealReturns={setRealReturns}
        />
      </SectionErrorBoundary>

      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Read-only notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <Eye className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">View-only access</p>
            <p className="text-xs text-blue-600">
              Your advisor manages this portfolio. You can view performance, leave comments, and approve or request changes.
            </p>
          </div>
        </div>

        {/* Allocation */}
        <SectionErrorBoundary label="Allocation">
          <CollapsibleSection
            title="Allocation"
            icon={<PieChart className="w-4 h-4 text-blue-500" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-5">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Allocation Wheel</h3>
                <AllocationPieChart holdings={holdings} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Allocation Breakdown</h3>
                <div className="space-y-3">
                  {['Core', 'Tilt', 'Satellite'].map((cat) => {
                    const COLORS = { Core: 'bg-blue-500', Tilt: 'bg-violet-500', Satellite: 'bg-amber-500' };
                    const catHoldings = holdings.filter((h) => h.category === cat);
                    const w = catHoldings.reduce((s, h) => s + h.weight_percent, 0);
                    if (w === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-600 w-16">{cat}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                            <div className={`${COLORS[cat]} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(w, 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono font-semibold text-slate-700 w-12 text-right">{w.toFixed(1)}%</span>
                        </div>
                        <div className="ml-16 text-xs text-slate-400">
                          {catHoldings.map((h) => h.ticker).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Portfolio Value</p>
                    <p className="text-lg font-bold text-slate-800">
                      {currentPortfolioValue ? `$${Math.round(currentPortfolioValue).toLocaleString()}` : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Holdings</p>
                    <p className="text-lg font-bold text-slate-800">{holdings.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </SectionErrorBoundary>

        {/* Performance chart */}
        <SectionErrorBoundary label="Performance chart">
          <CollapsibleSection
            title="Portfolio vs Benchmark Performance"
            icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          >
            <div className="p-3 sm:p-5">
              <PerformanceChart
                holdings={holdings}
                benchmarkTicker={benchmark}
                createdAt={portfolio?.created_at}
                cashPercent={cashPercent}
                drip={portfolio?.drip_enabled ?? true}
              />
            </div>
          </CollapsibleSection>
        </SectionErrorBoundary>

        {/* Performance summary cards */}
        <SectionErrorBoundary label="Performance summary">
          <CollapsibleSection
            title="Performance Summary"
            icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 p-4 sm:p-5">
              <div className="bg-slate-50 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <p className="text-xs font-medium text-slate-500 mb-1">Year-to-Date</p>
                <p className={`text-lg sm:text-xl font-bold ${ytdReturn > 0 ? 'text-emerald-600' : ytdReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                  {ytdReturn != null ? `${ytdReturn > 0 ? '+' : ''}${ytdReturn.toFixed(2)}%` : '--'}
                </p>
                {benchYtd != null && (
                  <p className="text-xs text-slate-400 mt-1">
                    {benchLabel || ''}: {benchYtd > 0 ? '+' : ''}{benchYtd.toFixed(2)}%
                  </p>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-400 to-indigo-500" />
                <p className="text-xs font-medium text-purple-600 mb-1">Since Creation</p>
                <p className={`text-lg sm:text-xl font-bold ${sinceReturn > 0 ? 'text-emerald-600' : sinceReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                  {sinceReturn != null ? `${sinceReturn > 0 ? '+' : ''}${sinceReturn.toFixed(2)}%` : '--'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-cyan-500" />
                <p className="text-xs font-medium text-slate-500 mb-1">1-Year Return</p>
                <p className={`text-lg sm:text-xl font-bold ${oneYearReturn > 0 ? 'text-emerald-600' : oneYearReturn < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                  {oneYearReturn != null ? `${oneYearReturn > 0 ? '+' : ''}${oneYearReturn.toFixed(2)}%` : '--'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                <p className="text-xs font-medium text-slate-500 mb-1">Portfolio Value</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">
                  {currentPortfolioValue ? `$${Math.round(currentPortfolioValue).toLocaleString()}` : '--'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {holdings.length}{' holdings'}{live === true && realReturns ? ' · live' : ''}
                </p>
              </div>
            </div>
          </CollapsibleSection>
        </SectionErrorBoundary>

        {/* Holdings performance chart */}
        {holdings.length > 1 && (
          <SectionErrorBoundary label="Holdings chart">
            <CollapsibleSection
              title="Individual Holdings Performance"
              icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
            >
              <div className="p-3 sm:p-5">
                <HoldingsPerformanceChart holdings={holdings} />
              </div>
            </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        {/* Holdings table + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <SectionErrorBoundary label="Holdings table">
            <div className="lg:col-span-2">
              <CollapsibleSection
                title="Your Holdings"
                icon={<BarChart3 className="w-4 h-4 text-slate-500" />}
                badge={<span className="text-xs font-normal text-slate-400">({holdings.length} positions)</span>}
              >
                <div className="overflow-x-auto p-3 sm:p-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Ticker</th>
                        <th className="hidden sm:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Name</th>
                        <th className="hidden sm:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Role</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Target %</th>
                        <th className="hidden sm:table-cell text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Current %</th>
                        <th className="hidden sm:table-cell text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h) => {
                        const drifted = currentWeights[h.ticker]?.driftedWeight;
                        const currentPrice = (live && prices[h.ticker]?.price) || h.last_price;
                        const dailyChange = live ? (typeof prices[h.ticker]?.changePercent === 'number' ? prices[h.ticker].changePercent : null) : null;
                        return (
                          <tr key={h.ticker} className="border-t border-slate-100">
                            <td className="py-2.5 pr-4">
                              <span className="font-mono font-semibold text-slate-800">{h.ticker}</span>
                            </td>
                            <td className="hidden sm:table-cell py-2.5 pr-4 text-slate-600">{h.name}</td>
                            <td className="hidden sm:table-cell py-2.5 pr-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                h.category === 'Core' ? 'bg-blue-50 text-blue-700'
                                  : h.category === 'Tilt' ? 'bg-violet-50 text-violet-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {h.category}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono text-slate-700">{h.weight_percent.toFixed(1)}%</td>
                            <td className="hidden sm:table-cell py-2.5 pr-4 text-right">
                              {drifted != null ? (
                                <span className={`font-mono text-sm ${
                                  Math.abs(drifted - h.weight_percent) < 0.5
                                    ? 'text-slate-500'
                                    : drifted > h.weight_percent
                                      ? 'text-emerald-600'
                                      : 'text-orange-500'
                                }`}>
                                  {drifted.toFixed(1)}%
                                </span>
                              ) : <span className="text-slate-300">--</span>}
                            </td>
                            <td className="hidden sm:table-cell py-2.5 text-right">
                              <div className="font-mono text-slate-700">
                                {currentPrice ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                              </div>
                              {dailyChange != null && (
                                <div className={`text-xs flex items-center justify-end gap-0.5 ${
                                  dailyChange > 0 ? 'text-emerald-500' : dailyChange < 0 ? 'text-red-500' : 'text-slate-400'
                                }`}>
                                  {dailyChange > 0 ? <TrendingUp className="w-3 h-3" /> : dailyChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                  {dailyChange > 0 ? '+' : ''}{dailyChange.toFixed(2)}%
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200">
                        <td className="py-2.5 font-semibold text-slate-700">Total</td>
                        <td className="hidden sm:table-cell" />
                        <td className="hidden sm:table-cell" />
                        <td className="py-2.5 text-right font-semibold font-mono text-emerald-600">{totalWeight.toFixed(1)}%</td>
                        <td className="hidden sm:table-cell" />
                        <td className="hidden sm:table-cell py-2.5 text-right font-semibold font-mono text-slate-700">
                          ${currentPortfolioValue ? Math.round(currentPortfolioValue).toLocaleString() : '--'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CollapsibleSection>
            </div>
          </SectionErrorBoundary>

          {/* Sidebar: details + approval */}
          <SectionErrorBoundary label="Portfolio details">
            <div className="space-y-4">
              <CollapsibleSection
                title="Portfolio Details"
                icon={<Eye className="w-4 h-4 text-slate-500" />}
              >
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Starting Value</span>
                    <span className="font-semibold text-slate-800">
                      ${(portfolio?.starting_value ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Current Value</span>
                    <span className="font-semibold text-slate-800">
                      ${currentPortfolioValue ? Math.round(currentPortfolioValue).toLocaleString() : '--'}
                    </span>
                  </div>
                  {benchmark && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Benchmark</span>
                      <span className="font-medium text-blue-600">{benchLabel || benchmark}</span>
                    </div>
                  )}
                  {cashPercent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Cash Reserve</span>
                      <span className="font-medium text-slate-700">{cashPercent}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">DRIP</span>
                    <span className="font-medium text-slate-700">{portfolio?.drip_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  {portfolio?.created_at && !isNaN(new Date(portfolio.created_at).getTime()) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Created</span>
                      <span className="font-medium text-slate-700">{new Date(portfolio.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {approval && (
                <div className={`rounded-xl border p-4 ${
                  approval.type === 'approval'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {approval.type === 'approval'
                      ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                      : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <span className={`text-sm font-semibold ${
                      approval.type === 'approval' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {approval.type === 'approval' ? 'Portfolio Approved' : 'Changes Requested'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {approval.created_at && !isNaN(new Date(approval.created_at).getTime())
                      ? new Date(approval.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                      : ''}
                  </p>
                  {approval.text && approval.text !== 'Approved the portfolio' && approval.text !== 'Requested changes' && (
                    <p className="text-sm mt-1 text-slate-600">{approval.text}</p>
                  )}
                </div>
              )}
            </div>
          </SectionErrorBoundary>
        </div>

        {/* Messages */}
        {portfolio && (
          <SectionErrorBoundary label="Messages">
            <CollapsibleSection
              title="Message Your Advisor"
              icon={<MessageCircle className="w-4 h-4 text-emerald-500" />}
              badge={<span className="text-xs text-slate-400">Communicate about your portfolio</span>}
            >
              <div className="p-0">
                <MessagePanel
                  portfolioId={portfolio.id}
                  userId={user.id}
                  userEmail={user.email || ''}
                  userRole="client"
                  showApprovalActions={true}
                  defaultOpen={true}
                />
              </div>
            </CollapsibleSection>
          </SectionErrorBoundary>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            Managed by your advisor · Powered by <span className="font-semibold text-emerald-600">AJA Wealth Management</span>
          </p>
        </div>
      </main>
    </div>
  );
}
