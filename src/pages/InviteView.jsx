import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, getInvite, acceptInvite } from '../context/AuthContext';
import AllocationPieChart from '../components/AllocationPieChart';
import PerformanceChart from '../components/PerformanceChart';
import MessagePanel from '../components/MessagePanel';

export default function InviteView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signUp, signIn } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Auth form state
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  useEffect(() => {
    getInvite(token).then((inv) => {
      if (inv) {
        setInvite(inv);
        if (inv.client_email) setEmail(inv.client_email);
      } else {
        // Fall back to URL-encoded invite data (cross-browser demo mode)
        const encoded = searchParams.get('d');
        if (encoded) {
          try {
            // Decode base64 → bytes → UTF-8 string → JSON
            const binary = atob(decodeURIComponent(encoded));
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            const jsonStr = new TextDecoder().decode(bytes);
            const decoded = JSON.parse(jsonStr);
            setInvite(decoded);
            if (decoded.client_email) setEmail(decoded.client_email);
          } catch {
            // Fallback: try legacy atob approach
            try {
              const decoded = JSON.parse(atob(decodeURIComponent(encoded)));
              setInvite(decoded);
              if (decoded.client_email) setEmail(decoded.client_email);
            } catch {
              setNotFound(true);
            }
          }
        } else {
          setNotFound(true);
        }
      }
      setLoading(false);
    });
  }, [token, searchParams]);

  // Auto-accept when user is logged in, then redirect to full Client Portal
  useEffect(() => {
    if (user && invite && !accepted) {
      acceptInvite(user.id, invite);
      setAccepted(true);
      // Give the user a moment to see the "Invite accepted" banner, then redirect to Client Portal
      setTimeout(() => navigate('/client-portal', { replace: true }), 1200);
    }
  }, [user, invite, accepted, navigate]);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, 'client'); // Invite signup is always a client account
      } else {
        await signIn(email, password);
      }
      // acceptInvite is called by the useEffect above once user is set
    } catch (err) {
      const msg = err.message || 'Authentication failed';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('rate_limit')) {
        setAuthError('Too many attempts — please wait a minute and try again.');
        setCooldown(60);
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-500 text-sm">Loading invite…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <div className="text-2xl">🔗</div>
        <h1 className="text-lg font-semibold text-slate-700">Invite not found</h1>
        <p className="text-sm text-slate-500">This invite link is invalid or has expired.</p>
      </div>
    );
  }

  const portfolio = invite.portfolio_snapshot;
  const inviteDate = new Date(invite.created_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
            WeightWatch Portfolios
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-sm text-slate-500 mt-1">{portfolio.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
              Client Portal
            </span>
            <span className="text-xs text-slate-400">Invited {inviteDate}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Auth prompt if not logged in — show ONLY this, no portfolio data */}
        {!user && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              You&rsquo;ve been invited to view &ldquo;{portfolio.name}&rdquo;
            </h2>
            <p className="text-sm text-slate-500 mb-1">
              {portfolio.holdings?.length || 0} holdings &middot; Invited {inviteDate}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              {mode === 'signup' ? 'Create a client account' : 'Log in'} to access your personalized client portal and view full portfolio details.
            </p>
            <form onSubmit={handleAuth} className="space-y-3 max-w-sm">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={8}
              />
              {authError && <p className="text-xs text-red-600">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading || cooldown > 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {authLoading ? 'Please wait…' : cooldown > 0 ? `Try again in ${cooldown}s` : mode === 'signup' ? 'Create Client Account' : 'Log In'}
              </button>
              <p className="text-xs text-slate-500 text-center">
                {mode === 'signup' ? (
                  <>Already have an account?{' '}
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => setMode('login')}>Log in</button>
                  </>
                ) : (
                  <>Need an account?{' '}
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => setMode('signup')}>Sign up</button>
                  </>
                )}
              </p>
            </form>
          </div>
        )}

        {/* ── Authenticated content (only visible after login/signup) ── */}
        {user && (
          <>
            {/* Accepted banner */}
            {accepted && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Invite accepted</p>
                  <p className="text-xs text-green-600">You have read-only access to this portfolio. Redirecting to your client portal…</p>
                </div>
                <button
                  className="text-sm text-blue-600 hover:underline font-medium"
                  onClick={() => navigate('/client-portal')}
                >
                  Go to Client Portal →
                </button>
              </div>
            )}

            {/* Holdings table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Holdings</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Ticker</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Name</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-4">Role</th>
                      <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Target %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((h) => (
                      <tr key={h.ticker} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-mono font-semibold text-slate-800">{h.ticker}</td>
                        <td className="py-2 pr-4 text-slate-600">{h.name}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            (h.category || 'Core') === 'Core' ? 'bg-blue-50 text-blue-700'
                              : (h.category || 'Core') === 'Tilt' ? 'bg-violet-50 text-violet-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {h.category || 'Core'}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-slate-700">{(h.weight_percent || 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie chart + allocation breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Allocation Wheel</h2>
                <AllocationPieChart holdings={portfolio.holdings} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Allocation Breakdown</h2>
                {['Core', 'Tilt', 'Satellite'].map((cat) => {
                  const COLORS = { Core: 'bg-blue-500', Tilt: 'bg-violet-500', Satellite: 'bg-amber-500' };
                  const w = portfolio.holdings
                    .filter((h) => (h.category || 'Core') === cat)
                    .reduce((s, h) => s + (h.weight_percent || 0), 0);
                  if (w === 0) return null;
                  return (
                    <div key={cat} className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-slate-500 w-16">{cat}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className={`${COLORS[cat]} h-2 rounded-full`} style={{ width: `${Math.min(w, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-700 w-10 text-right">{w.toFixed(1)}%</span>
                    </div>
                  );
                })}
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

            {/* Messages with advisor + approve/comment */}
            {accepted && (
              <MessagePanel
                portfolioId={invite.portfolio_ids?.[0] ?? invite.portfolio_snapshot?.id}
                userId={user.id}
                userEmail={user.email}
                userRole="client"
                showApprovalActions={true}
              />
            )}
          </>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          Powered by <span className="font-semibold text-blue-600">WeightWatch Portfolios</span>
        </p>
      </main>
    </div>
  );
}
