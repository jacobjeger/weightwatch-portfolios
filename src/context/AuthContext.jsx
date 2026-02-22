import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createDemoPortfolios } from '../lib/mockData';

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS = {
  users: 'wwp_users',
  session: 'wwp_session',
  portfolios: 'wwp_portfolios',
  activity: 'wwp_activity',
  settings: 'wwp_settings',
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────
function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function mockSignUp(email, password) {
  const users = lsGet(LS.users, {});
  if (users[email]) throw new Error('An account with this email already exists.');
  const user = { id: crypto.randomUUID(), email };
  users[email] = { ...user, password };
  lsSet(LS.users, users);
  lsSet(LS.session, user);
  // seed demo portfolios
  const existing = lsGet(LS.portfolios, []);
  if (!existing.find((p) => p.owner === user.id)) {
    lsSet(LS.portfolios, [...existing, ...createDemoPortfolios(user.id)]);
  }
  return user;
}

function mockSignIn(email, password) {
  const users = lsGet(LS.users, {});
  const stored = users[email];
  if (!stored || stored.password !== password) throw new Error('Invalid email or password.');
  const user = { id: stored.id, email: stored.email };
  lsSet(LS.session, user);
  return user;
}

function mockSignOut() {
  localStorage.removeItem(LS.session);
}

function mockResetPassword(email) {
  const users = lsGet(LS.users, {});
  if (!users[email]) throw new Error('No account found with that email.');
  // In mock mode, just succeed (no real email sent)
  return true;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialise session
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } else {
      const stored = lsGet(LS.session);
      setUser(stored ?? null);
      setLoading(false);
    }
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────────
  async function signUp(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data.user;
    }
    const u = mockSignUp(email, password);
    setUser(u);
    return u;
  }

  async function signIn(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.user;
    }
    const u = mockSignIn(email, password);
    setUser(u);
    return u;
  }

  async function signOut() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      mockSignOut();
      setUser(null);
    }
  }

  async function resetPassword(email) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return true;
    }
    return mockResetPassword(email);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resetPassword, isMockMode: !isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Portfolio data helpers (localStorage) ────────────────────────────────────
export function getPortfolios(userId) {
  return lsGet(LS.portfolios, []).filter((p) => p.owner === userId);
}

export function savePortfolio(portfolio) {
  const all = lsGet(LS.portfolios, []);
  const idx = all.findIndex((p) => p.id === portfolio.id);
  const updated = { ...portfolio, last_updated_at: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push({ ...updated, created_at: updated.last_updated_at });
  }
  lsSet(LS.portfolios, all);
  return updated;
}

export function deletePortfolios(ids) {
  const all = lsGet(LS.portfolios, []);
  lsSet(LS.portfolios, all.filter((p) => !ids.includes(p.id)));
}

// ─── Activity log helpers ─────────────────────────────────────────────────────
export function logActivity(userId, entry) {
  const log = lsGet(LS.activity, []);
  log.unshift({
    id: crypto.randomUUID(),
    user_id: userId,
    occurred_at: new Date().toISOString(),
    ...entry,
  });
  lsSet(LS.activity, log.slice(0, 500)); // cap at 500 entries
}

export function getActivity(userId) {
  return lsGet(LS.activity, []).filter((e) => e.user_id === userId);
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  primary_benchmark: 'SPY',
  inherit_defaults: true,
  default_timeframe: '1Y',
  hidden_timeframes: [],
  default_chart_range: '1Y',
  snapshot_refresh_interval: 60,
  confirm_deletes: true,
  activity_log_granularity: 'standard',
};

export function getSettings(userId) {
  const all = lsGet(LS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(all[userId] ?? {}) };
}

export function saveSettings(userId, partial) {
  const all = lsGet(LS.settings, {});
  all[userId] = { ...(all[userId] ?? DEFAULT_SETTINGS), ...partial };
  lsSet(LS.settings, all);
  return all[userId];
}
