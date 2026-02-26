import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
  const { resetPassword, isMockMode } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('rate_limit')) {
        setError('Too many attempts — please wait a minute and try again.');
        setCooldown(60);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <BarChart3 className="w-10 h-10 text-blue-600 mb-2" />
          <h1 className="text-xl font-bold text-slate-900">Reset Password</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {isMockMode && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            <strong>Demo mode:</strong> No email will actually be sent. Reset will succeed for any registered account email.
          </div>
        )}

        {sent ? (
          <div className="card p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="font-semibold text-slate-900 mb-1">Check your inbox</h2>
            <p className="text-sm text-slate-500 mb-4">
              {isMockMode
                ? 'In demo mode, password reset is simulated. No real email was sent.'
                : `A password reset link has been sent to ${email}.`}
            </p>
            <Link to="/" className="btn-primary inline-flex">
              Back to app
            </Link>
          </div>
        ) : (
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                <input
                  type="email"
                  className={`input ${error ? 'border-red-400' : ''}`}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com"
                  autoFocus
                />
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading || cooldown > 0}>
                {loading ? 'Sending…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send Reset Link'}
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-3.5 h-3.5" />Back to app
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
