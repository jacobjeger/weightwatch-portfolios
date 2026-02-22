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
      await signUp(email, password);
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

  return (
    <ModalShell title="Create Account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
