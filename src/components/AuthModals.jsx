import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

// ─── Login Modal ──────────────────────────────────────────────────────────────
export function LoginModal({ onClose, onSwitchToSignUp }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Log In" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? 'Logging in…' : 'Log In'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <button type="button" className="text-blue-600 hover:underline font-medium" onClick={onSwitchToSignUp}>
            Sign Up
          </button>
        </p>
        <p className="text-center text-sm">
          <a href="/reset-password" className="text-slate-500 hover:underline text-xs">
            Forgot your password?
          </a>
        </p>
      </form>
    </ModalShell>
  );
}

// ─── Sign Up Modal ────────────────────────────────────────────────────────────
export function SignUpModal({ onClose, onSwitchToLogin }) {
  const { signUp } = useAuth();
  const [accountType, setAccountType] = useState(null); // null = choosing, 'advisor' | 'client'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <ModalShell title="Check your email" onClose={onClose}>
        <div className="space-y-4 text-center">
          <p className="text-slate-600 text-sm">
            We sent a confirmation link to <span className="font-medium text-slate-900">{email}</span>.
            Click it to activate your account.
          </p>
          <p className="text-xs text-slate-400">Don't see it? Check your spam folder.</p>
          <button className="btn-primary w-full justify-center" onClick={onClose}>Done</button>
        </div>
      </ModalShell>
    );
  }

  // Step 1: Choose account type
  if (!accountType) {
    return (
      <ModalShell title="Create Account" onClose={onClose}>
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
            <button type="button" className="text-blue-600 hover:underline font-medium" onClick={onSwitchToLogin}>
              Log In
            </button>
          </p>
        </div>
      </ModalShell>
    );
  }

  // Step 2: Enter credentials
  return (
    <ModalShell title={`Create ${accountType === 'advisor' ? 'Advisor' : 'Client'} Account`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account type indicator */}
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
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <button type="button" className="text-blue-600 hover:underline font-medium" onClick={onSwitchToLogin}>
            Log In
          </button>
        </p>
      </form>
    </ModalShell>
  );
}

// ─── Shared modal shell ───────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
