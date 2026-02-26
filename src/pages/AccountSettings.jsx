import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getSettings, saveSettings } from '../context/AuthContext';
import { BENCHMARKS, BENCHMARK_META } from '../lib/mockData';
import { useToast } from '../context/ToastContext';

const TIMEFRAMES_ALL = ['1D', '7D', '1M', '3M', '6M', 'YTD', '1Y'];
const CHART_RANGES = ['1M', '3M', '6M', '1Y', 'Max'];
const REFRESH_OPTIONS = [
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '60 seconds', value: 60 },
  { label: '5 minutes',  value: 300 },
  { label: 'Manual',     value: 0 },
];
const LOG_GRANULARITY = [
  { label: 'Standard — log major actions only', value: 'standard' },
  { label: 'Verbose — log every weight change',  value: 'verbose' },
  { label: 'Off — disable activity logging',      value: 'off' },
];

function SectionCard({ title, children, onSave }) {
  return (
    <div className="card p-5">
      <h2 className="section-title mb-4">{title}</h2>
      {children}
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onSave}>Save</button>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [settings, setSettings] = useState(() => user ? getSettings(user.id) : {});
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  function set(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function persist(label) {
    if (user) saveSettings(user.id, settings);
    toast.success(`${label} saved`);
  }

  function toggleTimeframe(tf) {
    const hidden = settings.hidden_timeframes ?? [];
    set('hidden_timeframes',
      hidden.includes(tf) ? hidden.filter((t) => t !== tf) : [...hidden, tf]
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>

      {/* Benchmark Defaults */}
      <SectionCard title="Benchmark Defaults" onSave={() => persist('Benchmark defaults')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Primary Benchmark</label>
            <select className="input" value={settings.primary_benchmark ?? ''} onChange={(e) => set('primary_benchmark', e.target.value)}>
              <option value="">— None —</option>
              {BENCHMARKS.map((b) => (
                <option key={b} value={b}>{BENCHMARK_META[b]?.label ?? b} ({b})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="inherit"
              className="rounded border-slate-300 text-blue-600"
              checked={settings.inherit_defaults ?? true}
              onChange={(e) => set('inherit_defaults', e.target.checked)}
            />
            <label htmlFor="inherit" className="text-sm text-slate-700">New portfolios inherit account benchmark defaults</label>
          </div>
        </div>
      </SectionCard>

      {/* Performance Timeframes */}
      <SectionCard title="Performance Timeframes" onSave={() => persist('Timeframe settings')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Headline Timeframe</label>
            <select className="input" value={settings.default_timeframe ?? '1Y'} onChange={(e) => set('default_timeframe', e.target.value)}>
              {TIMEFRAMES_ALL.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Hide Timeframes</p>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES_ALL.map((tf) => {
                const hidden = (settings.hidden_timeframes ?? []).includes(tf);
                return (
                  <button
                    key={tf}
                    onClick={() => toggleTimeframe(tf)}
                    className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                      hidden
                        ? 'bg-red-50 border-red-300 text-red-700 line-through'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2">Click a timeframe to hide it from performance tables.</p>
          </div>
        </div>
      </SectionCard>

      {/* Chart Display */}
      <SectionCard title="Chart Display" onSave={() => persist('Chart settings')}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Chart Range</label>
          <select className="input" value={settings.default_chart_range ?? '1Y'} onChange={(e) => set('default_chart_range', e.target.value)}>
            {CHART_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </SectionCard>

      {/* Real-Time Snapshot */}
      <SectionCard title="Live Snapshot" onSave={() => persist('Snapshot settings')}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Refresh Interval</label>
          <select
            className="input"
            value={settings.snapshot_refresh_interval ?? 60}
            onChange={(e) => set('snapshot_refresh_interval', parseInt(e.target.value))}
          >
            {REFRESH_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </SectionCard>

      {/* Portfolio Behavior */}
      <SectionCard title="Portfolio Behavior" onSave={() => persist('Behavior settings')}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="confirmDeletes"
              className="rounded border-slate-300 text-blue-600"
              checked={settings.confirm_deletes ?? true}
              onChange={(e) => set('confirm_deletes', e.target.checked)}
            />
            <label htmlFor="confirmDeletes" className="text-sm text-slate-700">
              Show confirmation dialog before deleting portfolios
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Activity Logging */}
      <SectionCard title="Activity Logging" onSave={() => persist('Logging settings')}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Log Granularity</label>
          <div className="space-y-2">
            {LOG_GRANULARITY.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="granularity"
                  value={opt.value}
                  className="text-blue-600"
                  checked={(settings.activity_log_granularity ?? 'standard') === opt.value}
                  onChange={() => set('activity_log_granularity', opt.value)}
                />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Danger Zone — Delete Account */}
      <div className="card border-2 border-red-200 p-5">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-sm text-slate-600 mb-4">
          Permanently delete your account and all associated data. This includes all portfolios,
          settings, activity history, messages, invites, and client links.
          <strong className="text-red-600"> This action cannot be undone.</strong>
        </p>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="input border-red-200 focus:border-red-400 focus:ring-red-400"
            />
          </div>
          <button
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
            disabled={deleteConfirm !== 'DELETE' || deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await deleteAccount();
                toast.success('Account deleted');
                navigate('/', { replace: true });
              } catch (err) {
                toast.error('Failed to delete account: ' + (err.message || 'Unknown error'));
                setDeleting(false);
              }
            }}
          >
            {deleting ? 'Deleting…' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
