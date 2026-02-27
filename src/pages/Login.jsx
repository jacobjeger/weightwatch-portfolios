import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function rateLimitMsg(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('rate_limit')) {
    return 'Too many attempts — please wait a minute and try again.';
  }
  return null;
}

function Field({ label, type, value, onChange, error }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          className={`input pr-8 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={isPassword ? 'current-password' : 'email'}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function Login() {
  const { signIn, user, role } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If already logged in, redirect based on role
  useEffect(() => {
    if (user) navigate(role === 'client' ? '/client-portal' : '/', { replace: true });
  }, [user, role, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      // Role-based redirect happens via the useEffect above after state updates
    } catch (err) {
      const friendly = rateLimitMsg(err);
      if (friendly) { setError(friendly); setCooldown(60); }
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || cooldown > 0;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Log in to your AJA Wealth Management account</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={disabled}>
              {loading ? 'Logging in…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Log In'}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:underline font-medium">
                Sign Up
              </Link>
            </p>
            <Link to="/reset-password" className="text-slate-500 hover:underline text-xs">
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
