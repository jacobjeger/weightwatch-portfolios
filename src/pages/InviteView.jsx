import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, getInvite, acceptInvite } from '../context/AuthContext';
import AllocationPieChart from '../components/AllocationPieChart';
import PerformanceChart from '../components/PerformanceChart';

export default function InviteView() {
  const { token } = useParams();
  const navigate = useNavigate();
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

  useEffect(() => {
    getInvite(token).then((inv) => {
      if (!inv) setNotFound(true);
      else {
        setInvite(inv);
        if (inv.client_email) setEmail(inv.client_email);
      }
      setLoading(false);
    });
  }, [token]);

  // Auto-accept when user is logged in
  useEffect(() => {
    if (user && invite && !accepted) {
      acceptInvite(user.id, invite);
      setAccepted(true);
    }
  }, [user, invite, accepted]);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      // acceptInvite is called by the useEffect above once user is set
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
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
        {/* Auth prompt if not logged in */}
        {!user && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              You&rsquo;ve been invited to view this portfolio
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {mode === 'signup' ? 'Create an account' : 'Log in'} to access your personalized client portal.
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
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {authError && <p className="text-xs text-red-600">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {authLoading ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Log In'}
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

        {/* Accepted banner */}
        {user && accepted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Invite accepted</p>
              <p className="text-xs text-green-600">You have read-only access to this portfolio.</p>
            </div>
            <button
              className="text-sm text-blue-600 hover:underline font-medium"
              onClick={() => navigate('/')}
            >
              Go to Dashboard →
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

        <p className="text-center text-xs text-slate-400 pb-4">
          Powered by <span className="font-semibold text-blue-600">WeightWatch Portfolios</span>
        </p>
      </main>
    </div>
  );
}
