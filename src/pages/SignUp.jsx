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
          autoComplete={isPassword ? 'new-password' : 'email'}
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

export default function SignUp() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown > 0]);

  function validate() {
    const errs = {};
    if (!email) errs.email = 'Email is required.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (password !== confirm) errs.confirm = 'Passwords do not match.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await signUp(email, password, accountType);
      setSent(true);
    } catch (err) {
      const friendly = rateLimitMsg(err);
      if (friendly) { setErrors({ general: friendly }); setCooldown(60); }
      else setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendCooldown(60);
    try {
      await signUp(email, password, accountType);
    } catch {
      // silently ignore — cooldown prevents spam
    }
  }

  // Confirmation sent screen
  if (sent) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">Check your email</h2>
            <div className="space-y-4 text-center">
              <p className="text-slate-600 text-sm">
                We sent a confirmation link to <span className="font-medium text-slate-900">{email}</span>.
                Click it to activate your account.
              </p>
              <p className="text-xs text-slate-400">Don't see it? Check your spam folder or try resending.</p>
              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1 justify-center text-sm"
                  disabled={resendCooldown > 0}
                  onClick={handleResend}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
                </button>
                <Link to="/login" className="btn-secondary flex-1 justify-center text-sm text-center">
                  Back to Login
                </Link>
              </div>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-blue-600 hover:underline"
                onClick={() => { setSent(false); setEmail(''); }}
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
          <p className="text-sm text-slate-500 mt-1">Get started with AJA Wealth Management</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {/* Step 1: Choose account type */}
          {!accountType ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-2">What type of account would you like to create?</p>

              <button
                type="button"
                className="w-full text-left border-2 border-slate-200 hover:border-blue-400 rounded-xl p-4 transition-colors group"
                onClick={() => setAccountType('advisor')}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Advisor</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Build and manage portfolios for your clients. Full access to create, edit, and share.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="w-full text-left border-2 border-slate-200 hover:border-emerald-400 rounded-xl p-4 transition-colors group"
                onClick={() => setAccountType('client')}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Client</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      View portfolios your advisor manages for you. Comment, approve, or request changes.
                    </p>
                  </div>
                </div>
              </button>

              <p className="text-center text-sm text-slate-500 pt-2">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium">
                  Log In
                </Link>
              </p>
            </div>
          ) : (
            /* Step 2: Enter credentials */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                accountType === 'advisor'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}>
                <span className="font-medium">{accountType === 'advisor' ? 'Advisor' : 'Client'} account</span>
                <button
                  type="button"
                  className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                  onClick={() => setAccountType(null)}
                >
                  Change
                </button>
              </div>

              <Field label="Email" type="email" value={email} onChange={setEmail} error={errors.email} />
              <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password} />
              <Field label="Confirm Password" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} />
              {errors.general && <p className="text-sm text-red-500">{errors.general}</p>}
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading || cooldown > 0}>
                {loading ? 'Creating account…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Sign Up'}
              </button>
              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium">
                  Log In
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
