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
  shares: 'wwp_shares',
  invites: 'wwp_invites',
  clients: 'wwp_clients', // { [userId]: { advisor_id, portfolio_ids } }
  messages: 'wwp_messages',
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
  const [role, setRole] = useState('advisor'); // 'advisor' | 'client'

  // Detect role when user changes
  useEffect(() => {
    if (user) {
      const clients = lsGet(LS.clients, {});
      setRole(clients[user.id] ? 'client' : 'advisor');
    } else {
      setRole('advisor');
    }
  }, [user]);

  // Initialise session
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) syncFromSupabase(u.id).finally(() => setLoading(false));
        else setLoading(false);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          if (_event === 'SIGNED_IN') {
            // Fresh login on a browser with no cached session:
            // re-engage the loading gate so ProtectedRoute holds until sync completes.
            // Without this, Dashboard mounts and reads empty localStorage before sync finishes.
            setLoading(true);
            syncFromSupabase(u.id).finally(() => setLoading(false));
          } else {
            // INITIAL_SESSION / TOKEN_REFRESHED:
            // getSession() above already awaited sync on page load; fire-and-forget is fine.
            syncFromSupabase(u.id);
          }
        }
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
    <AuthContext.Provider value={{ user, loading, role, signUp, signIn, signOut, resetPassword, isMockMode: !isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Supabase portfolio sync ──────────────────────────────────────────────────
// Fetches the user's portfolios from Supabase and writes them into localStorage.
// Called on login/session restore so the local cache is always up-to-date.
export async function syncFromSupabase(userId) {
  if (!isSupabaseConfigured || !userId) return;
  const { data, error } = await supabase
    .from('user_portfolios')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (!error && data?.data) {
    // Merge: Supabase is the source of truth; overwrite local cache
    lsSet(LS.portfolios, data.data);
  }
}

// Pushes the full portfolios array for a user to Supabase (fire-and-forget).
function pushToSupabase(userId, all) {
  if (!isSupabaseConfigured || !userId) return;
  supabase
    .from('user_portfolios')
    .upsert({ user_id: userId, data: all, updated_at: new Date().toISOString() })
    .then(({ error }) => { if (error) console.warn('[Sync] Supabase write error:', error.message); });
}

// ─── Portfolio data helpers ───────────────────────────────────────────────────
export function getPortfolios(userId) {
  const all = lsGet(LS.portfolios, []);
  const owned = all.filter((p) => p.owner === userId);
  // Also include portfolios shared via invite (client → advisor's portfolios)
  const clientData = lsGet(LS.clients, {})[userId];
  if (clientData?.portfolio_ids) {
    const shared = all.filter(
      (p) => clientData.portfolio_ids.includes(p.id) && p.owner !== userId
    );
    return [...owned, ...shared];
  }
  return owned;
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
  pushToSupabase(portfolio.owner, all);
  return updated;
}

export function deletePortfolios(ids, userId) {
  const all = lsGet(LS.portfolios, []).filter((p) => !ids.includes(p.id));
  lsSet(LS.portfolios, all);
  if (userId) pushToSupabase(userId, all);
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

// ─── Share token helpers ───────────────────────────────────────────────────────
// Creates a share token storing a full portfolio snapshot.
// Works in both Supabase mode (share_tokens table) and mock mode (localStorage).
export async function createShareToken(userId, portfolio) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const snapshot = { ...portfolio, _sharedAt: new Date().toISOString() };
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('share_tokens')
      .insert({ token, owner_id: userId, portfolio_snapshot: snapshot });
    if (error) throw error;
  } else {
    const shares = lsGet(LS.shares, {});
    shares[token] = snapshot;
    lsSet(LS.shares, shares);
  }
  return token;
}

// Retrieves the portfolio snapshot for a given share token (no auth required).
export async function getSharedPortfolio(token) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('share_tokens')
      .select('portfolio_snapshot')
      .eq('token', token)
      .maybeSingle();
    if (error || !data) return null;
    return data.portfolio_snapshot;
  } else {
    const shares = lsGet(LS.shares, {});
    return shares[token] ?? null;
  }
}

// ─── Invite helpers ──────────────────────────────────────────────────────────
// Creates an invite token that grants a client read-only access to portfolios.
export async function inviteClient(advisorId, clientEmail, portfolioIds, snapshot) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const invite = {
    token,
    advisor_id: advisorId,
    client_email: clientEmail,
    portfolio_ids: portfolioIds,
    portfolio_snapshot: snapshot,
    created_at: new Date().toISOString(),
  };
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('invites').insert(invite);
    if (error) throw error;
  } else {
    const invites = lsGet(LS.invites, {});
    invites[token] = invite;
    lsSet(LS.invites, invites);
  }
  return token;
}

// Retrieves an invite by token.
export async function getInvite(token) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } else {
    const invites = lsGet(LS.invites, {});
    return invites[token] ?? null;
  }
}

// Accepts an invite: stores client relationship so role detection picks it up.
export function acceptInvite(userId, invite) {
  const clients = lsGet(LS.clients, {});
  clients[userId] = {
    advisor_id: invite.advisor_id,
    portfolio_ids: invite.portfolio_ids,
    accepted_at: new Date().toISOString(),
  };
  lsSet(LS.clients, clients);
}

// ─── Message helpers ─────────────────────────────────────────────────────────
// Advisor ↔ client messaging per portfolio.
export function getMessages(portfolioId) {
  return lsGet(LS.messages, [])
    .filter((m) => m.portfolio_id === portfolioId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function sendMessage(message) {
  const all = lsGet(LS.messages, []);
  const msg = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...message,
  };
  all.push(msg);
  lsSet(LS.messages, all);
  return msg;
}

// Returns the most recent approval or change_request for a portfolio.
export function getLatestApproval(portfolioId) {
  return lsGet(LS.messages, [])
    .filter((m) => m.portfolio_id === portfolioId && (m.type === 'approval' || m.type === 'change_request'))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null;
}
