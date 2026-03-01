import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createDemoPortfolios } from '../lib/mockData';
import { sanitizePortfolio, sanitizeMessage, sanitizeApproval, sanitizeInvite } from '../lib/sanitize';

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS = {
  users: 'wwp_users',
  session: 'wwp_session',
  portfolios: 'wwp_portfolios',
  activity: 'wwp_activity',
  settings: 'wwp_settings',
  shares: 'wwp_shares',
  invites: 'wwp_invites',
  clients: 'wwp_clients', // { [userId]: { advisor_id, portfolio_ids, accepted_at } }
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

function mockSignUp(email, password, accountType = 'advisor') {
  const users = lsGet(LS.users, {});
  if (users[email]) throw new Error('An account with this email already exists.');
  const user = { id: crypto.randomUUID(), email };
  users[email] = { ...user, password };
  lsSet(LS.users, users);
  lsSet(LS.session, user);

  if (accountType === 'client') {
    // Mark as client with no advisor yet
    const clients = lsGet(LS.clients, {});
    clients[user.id] = { advisor_id: null, portfolio_ids: [], accepted_at: null };
    lsSet(LS.clients, clients);
    // Auto-accept any pending invites for this email
    autoLinkInvites(user.id, email);
  } else {
    // Seed demo portfolios for advisors only
    const existing = lsGet(LS.portfolios, []);
    if (!existing.find((p) => p.owner === user.id)) {
      lsSet(LS.portfolios, [...existing, ...createDemoPortfolios(user.id)]);
    }
  }
  return user;
}

// Auto-accept any pending invites that match this user's email.
// Called during sign-in and sign-up so localStorage has the right data
// before React state updates trigger child component renders.
function autoLinkInvites(userId, email) {
  const invites = lsGet(LS.invites, {});
  const clients = lsGet(LS.clients, {});
  if (!clients[userId]) return; // not a client account

  let changed = false;
  Object.values(invites).forEach((inv) => {
    if (
      inv.client_email?.toLowerCase() === email?.toLowerCase() &&
      !inv.accepted_by
    ) {
      const existing = clients[userId];
      const existingPids = existing?.portfolio_ids ?? [];
      const newPids = inv.portfolio_ids ?? [];
      const merged = [...new Set([...existingPids, ...newPids])];
      clients[userId] = {
        advisor_id: inv.advisor_id ?? existing?.advisor_id ?? null,
        portfolio_ids: merged,
        accepted_at: existing?.accepted_at ?? new Date().toISOString(),
      };
      inv.accepted_by = userId;
      inv.accepted_at = inv.accepted_at ?? new Date().toISOString();

      // Store portfolio snapshot so getPortfolios can find it
      if (inv.portfolio_snapshot) {
        const all = lsGet(LS.portfolios, []);
        const snap = sanitizePortfolio(inv.portfolio_snapshot);
        if (snap) {
          const idx = all.findIndex((p) => p.id === snap.id);
          if (idx >= 0) all[idx] = { ...all[idx], ...snap };
          else all.push(snap);
          lsSet(LS.portfolios, all);
        }
      }
      changed = true;
    }
  });
  if (changed) {
    lsSet(LS.clients, clients);
    lsSet(LS.invites, invites);
  }
}

function mockSignIn(email, password) {
  const users = lsGet(LS.users, {});
  const stored = users[email];
  if (!stored || stored.password !== password) throw new Error('Invalid email or password.');
  const user = { id: stored.id, email: stored.email };
  lsSet(LS.session, user);
  // Auto-accept any pending invites for this email
  autoLinkInvites(user.id, email);
  return user;
}

function mockSignOut() {
  localStorage.removeItem(LS.session);
}

function mockResetPassword(email) {
  const users = lsGet(LS.users, {});
  if (!users[email]) throw new Error('No account found with that email.');
  return true;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('advisor'); // 'advisor' | 'client'

  // Detect role when user changes.
  // An account is only a "client" if it was explicitly created as one AND does
  // not own any portfolios.  Advisors who test their own invite links get an
  // entry in the clients map but should still behave as advisors.
  useEffect(() => {
    if (user) {
      const clients = lsGet(LS.clients, {});
      const clientEntry = clients[user.id];
      const portfolios = lsGet(LS.portfolios, []);
      const ownsPortfolios = portfolios.some((p) => p.owner === user.id);

      // If the user owns portfolios, they are an advisor regardless of
      // whether they also appear in the clients map.
      if (ownsPortfolios) {
        setRole('advisor');
      } else if (clientEntry) {
        setRole('client');
      } else {
        setRole('advisor');
      }
    } else {
      setRole('advisor');
    }
  }, [user]);

  // Initialise session
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        let u = session?.user ?? null;
        // Fall back to localStorage for users who signed up but haven't
        // confirmed email yet (no Supabase session, but LS.session exists)
        if (!u) {
          const pending = lsGet(LS.session);
          if (pending?.id && pending?.email) {
            u = pending;
            autoLinkInvites(u.id, u.email);
          }
        }
        setUser(u);
        if (u) syncFromSupabase(u.id, u.email).finally(() => setLoading(false));
        else setLoading(false);
      }).catch((err) => {
        console.error('[Auth] Session fetch failed:', err);
        setLoading(false);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null;
        if (u) {
          // Supabase session is live — clear any pending localStorage session
          localStorage.removeItem(LS.session);
          setUser(u);
          if (_event === 'SIGNED_IN') {
            setLoading(true);
            syncFromSupabase(u.id, u.email).finally(() => setLoading(false));
          } else {
            syncFromSupabase(u.id, u.email);
          }
        } else if (_event === 'SIGNED_OUT') {
          // Explicit sign-out — clear pending session too
          localStorage.removeItem(LS.session);
          setUser(null);
        }
        // For other events with no session (e.g., TOKEN_REFRESHED failure),
        // don't reset user — keep the pending localStorage session if it exists
      });
      return () => subscription.unsubscribe();
    } else {
      const stored = lsGet(LS.session);
      // Auto-link any new invites on session restore (e.g. advisor invited after client signed up)
      if (stored) autoLinkInvites(stored.id, stored.email);
      setUser(stored ?? null);
      setLoading(false);
    }
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────────
  async function signUp(email, password, accountType = 'advisor') {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { account_type: accountType },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (data.user) {
        // Mark client accounts in clients mapping
        if (accountType === 'client') {
          const clients = lsGet(LS.clients, {});
          clients[data.user.id] = { advisor_id: null, portfolio_ids: [], accepted_at: null };
          lsSet(LS.clients, clients);
        }

        // Set user immediately so invite acceptance and navigation work.
        // If email confirmation is required (data.session is null), the auth
        // listener won't fire until confirmation, so we set user manually.
        const userObj = { id: data.user.id, email: data.user.email };
        setUser(userObj);
        autoLinkInvites(userObj.id, email);
        // Persist so the session survives page refresh
        lsSet(LS.session, userObj);

        // Send a welcome/confirmation email via Edge Function (independent
        // of Supabase's built-in auth emails which require SMTP in dashboard)
        sendEmail('welcome', email, {
          email,
          account_type: accountType,
          app_url: window.location.origin,
        }).catch(() => {}); // best-effort
      }
      return data.user;
    }
    const u = mockSignUp(email, password, accountType);
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
    // Clear pending session in both modes
    localStorage.removeItem(LS.session);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      mockSignOut();
    }
    setUser(null);
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

  // Refresh client portfolios by re-syncing from advisor's data in Supabase
  const refreshClientPortfolios = useCallback(async () => {
    if (!user) return;
    const clientData = lsGet(LS.clients, {})[user.id];
    if (!clientData?.advisor_id) return;

    // Sync advisor's portfolios from Supabase to get latest changes
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('user_portfolios')
          .select('data')
          .eq('user_id', clientData.advisor_id)
          .maybeSingle();
        if (!error && data?.data) {
          const advisorPortfolios = data.data;
          const all = lsGet(LS.portfolios, []);
          // Replace advisor's portfolios that are linked to this client
          const linkedIds = new Set(clientData.portfolio_ids || []);
          const withoutLinked = all.filter((p) => !linkedIds.has(p.id));
          const linkedFromAdvisor = advisorPortfolios
            .filter((p) => linkedIds.has(p.id))
            .map(sanitizePortfolio)
            .filter(Boolean);
          lsSet(LS.portfolios, [...withoutLinked, ...linkedFromAdvisor]);
          console.info('[Sync] Client portfolios refreshed from advisor data');
        }
      } catch (e) {
        console.warn('[Sync] Client portfolio refresh failed:', e.message);
      }
    }
  }, [user]);

  // Delete all account data and the account itself
  async function deleteAccount() {
    if (!user) return;
    const userId = user.id;
    const email = user.email;

    // 1) Delete from Supabase tables (best-effort)
    if (isSupabaseConfigured) {
      try { await supabase.from('user_portfolios').delete().eq('user_id', userId); } catch {}
      try { await supabase.from('invites').delete().or(`advisor_id.eq.${userId},accepted_by.eq.${userId}`); } catch {}
      try { await supabase.from('messages').delete().eq('sender_id', userId); } catch {}
      try { await supabase.from('activity_log').delete().eq('user_id', userId); } catch {}
      try { await supabase.from('share_tokens').delete().eq('owner_id', userId); } catch {}
    }

    // 2) Clear all localStorage data for this user
    const portfolios = lsGet(LS.portfolios, []).filter((p) => p.owner !== userId);
    lsSet(LS.portfolios, portfolios);

    const settings = lsGet(LS.settings, {});
    delete settings[userId];
    lsSet(LS.settings, settings);

    const clients = lsGet(LS.clients, {});
    delete clients[userId];
    lsSet(LS.clients, clients);

    const activity = lsGet(LS.activity, []).filter((a) => a.user_id !== userId);
    lsSet(LS.activity, activity);

    const messages = lsGet(LS.messages, []).filter((m) => m.sender_id !== userId);
    lsSet(LS.messages, messages);

    // Remove invites created by or accepted by this user
    const invites = lsGet(LS.invites, {});
    for (const [token, inv] of Object.entries(invites)) {
      if (inv.advisor_id === userId || inv.accepted_by === userId) delete invites[token];
    }
    lsSet(LS.invites, invites);

    // Remove mock user entry
    const users = lsGet(LS.users, {});
    if (email && users[email]) {
      delete users[email];
      lsSet(LS.users, users);
    }

    // 3) Sign out
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      mockSignOut();
    }
    setUser(null);
    localStorage.removeItem(LS.session);
  }

  return (
    <AuthContext.Provider value={{ user, loading, role, signUp, signIn, signOut, resetPassword, refreshClientPortfolios, deleteAccount, isMockMode: !isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Supabase portfolio sync ──────────────────────────────────────────────────
// The ONLY reliable cross-browser sync table is user_portfolios (JSONB blob).
// All other tables may not exist or may have schema mismatches, so each is
// wrapped in try/catch and failures are non-fatal.

export async function syncFromSupabase(userId, userEmail) {
  if (!isSupabaseConfigured || !userId) return;

  // 1) Portfolios + settings — the critical sync path (user_portfolios table with JSONB)
  try {
    const { data, error } = await supabase
      .from('user_portfolios')
      .select('data, settings')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data) {
      if (data.data) {
        // Merge instead of overwrite — preserve portfolio snapshots stored by acceptInvite
        const existing = lsGet(LS.portfolios, []);
        const synced = data.data;
        const syncedIds = new Set(synced.map((p) => p.id));
        // Keep local portfolios that aren't in the Supabase set (e.g. shared snapshots)
        const kept = existing.filter((p) => !syncedIds.has(p.id));
        lsSet(LS.portfolios, [...synced, ...kept]);
        console.info('[Sync] Portfolios loaded from Supabase (' + synced.length + ' synced, ' + kept.length + ' local kept)');
      }
      if (data.settings) {
        const allSettings = lsGet(LS.settings, {});
        allSettings[userId] = { ...DEFAULT_SETTINGS, ...data.settings };
        lsSet(LS.settings, allSettings);
        console.info('[Sync] Settings loaded from Supabase');
      }
    } else if (error) {
      console.warn('[Sync] Portfolio fetch error:', error.message);
    }
  } catch (e) {
    console.warn('[Sync] Portfolio fetch failed:', e.message);
  }

  // 2) Invites — pull by client email AND by accepted_by user ID
  try {
    const invites = lsGet(LS.invites, {});
    const clients = lsGet(LS.clients, {});

    // Helper: merge an invite's portfolio_ids into the client entry
    function mergeInvite(inv) {
      invites[inv.token] = inv;
      const existing = clients[userId];
      const existingPids = existing?.portfolio_ids ?? [];
      const newPids = inv.portfolio_ids ?? [];
      const merged = [...new Set([...existingPids, ...newPids])];
      clients[userId] = {
        advisor_id: inv.advisor_id ?? existing?.advisor_id ?? null,
        portfolio_ids: merged,
        accepted_at: existing?.accepted_at ?? inv.accepted_at ?? new Date().toISOString(),
      };
      // Also store portfolio snapshot if present so getPortfolios can find it
      if (inv.portfolio_snapshot) {
        const all = lsGet(LS.portfolios, []);
        const snap = sanitizePortfolio(inv.portfolio_snapshot);
        if (snap) {
          const idx = all.findIndex((p) => p.id === snap.id);
          if (idx >= 0) all[idx] = { ...all[idx], ...snap };
          else all.push(snap);
          lsSet(LS.portfolios, all);
        }
      }
    }

    // Fetch invites where this user's email was invited
    if (userEmail) {
      const { data: invData } = await supabase
        .from('invites')
        .select('*')
        .eq('client_email', userEmail);
      if (invData?.length) invData.forEach(mergeInvite);
    }

    // Also fetch invites this user already accepted (by user ID)
    const { data: acceptedInvs } = await supabase
      .from('invites')
      .select('*')
      .eq('accepted_by', userId);
    if (acceptedInvs?.length) acceptedInvs.forEach(mergeInvite);

    lsSet(LS.invites, invites);
    lsSet(LS.clients, clients);
  } catch (e) {
    console.warn('[Sync] Invites fetch failed:', e.message);
  }

  // 3) Messages — fetch messages the user sent AND messages for portfolios they can access
  try {
    // Get all portfolio IDs this user has access to (owned + shared via invites)
    const clientData = lsGet(LS.clients, {})[userId];
    const ownedPortfolios = lsGet(LS.portfolios, []).filter((p) => p.owner === userId).map((p) => p.id);
    const sharedPortfolioIds = clientData?.portfolio_ids ?? [];
    const allPortfolioIds = [...new Set([...ownedPortfolios, ...sharedPortfolioIds])];

    // Fetch messages the user sent
    const { data: sentMsgs } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: true });

    // Fetch messages for portfolios the user can access (includes advisor messages)
    let portfolioMsgs = [];
    if (allPortfolioIds.length > 0) {
      const { data: pMsgs } = await supabase
        .from('messages')
        .select('*')
        .in('portfolio_id', allPortfolioIds)
        .order('created_at', { ascending: true });
      portfolioMsgs = pMsgs ?? [];
    }

    // Merge and deduplicate
    const allMsgs = [...(sentMsgs ?? []), ...portfolioMsgs];
    const deduped = Object.values(Object.fromEntries(allMsgs.map((m) => [m.id, m])));
    if (deduped.length) {
      const existing = lsGet(LS.messages, []);
      const existingIds = new Set(existing.map((m) => m.id));
      const merged = [...existing, ...deduped.filter((m) => !existingIds.has(m.id))];
      lsSet(LS.messages, merged);
    }
  } catch (e) {
    console.warn('[Sync] Messages fetch failed:', e.message);
  }

  // 4) Activity log
  try {
    const { data: actData } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(500);
    if (actData?.length) {
      const existing = lsGet(LS.activity, []);
      const existingIds = new Set(existing.map((a) => a.id));
      const merged = [...actData.filter((a) => !existingIds.has(a.id)), ...existing].slice(0, 500);
      lsSet(LS.activity, merged);
    }
  } catch (e) {
    console.warn('[Sync] Activity log fetch failed:', e.message);
  }
}

// Pushes the full portfolios array for a user to Supabase.
// This is the CRITICAL sync operation for cross-browser support.
function pushToSupabase(userId, all) {
  if (!isSupabaseConfigured || !userId) return;
  supabase
    .from('user_portfolios')
    .upsert({ user_id: userId, data: all, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) {
        console.error('[Sync] CRITICAL: Portfolio save to Supabase FAILED:', error.message);
      } else {
        console.info('[Sync] Portfolios saved to Supabase');
      }
    })
    .catch((err) => console.error('[Sync] Portfolio save rejected:', err.message));
}

// Push a message to Supabase (best-effort — never blocks)
function pushMessageToSupabase(msg) {
  if (!isSupabaseConfigured) return;
  supabase.from('messages').insert(msg)
    .then(({ error }) => { if (error) console.warn('[Sync] Message write skipped:', error.message); })
    .catch((err) => console.warn('[Sync] Message write rejected:', err.message));
}

// Push activity to Supabase (best-effort)
function pushActivityToSupabase(entry) {
  if (!isSupabaseConfigured) return;
  supabase.from('activity_log').insert(entry)
    .then(({ error }) => { if (error) console.warn('[Sync] Activity write skipped:', error.message); })
    .catch((err) => console.warn('[Sync] Activity write rejected:', err.message));
}

// ─── Portfolio data helpers ───────────────────────────────────────────────────
export function getPortfolios(userId) {
  const all = lsGet(LS.portfolios, []);
  const owned = all.filter((p) => p.owner === userId);
  const clientData = lsGet(LS.clients, {})[userId];
  let result = owned;
  if (clientData?.portfolio_ids) {
    const shared = all.filter(
      (p) => clientData.portfolio_ids.includes(p.id) && p.owner !== userId
    );
    result = [...owned, ...shared];
  }
  return result.map(sanitizePortfolio).filter(Boolean);
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
  // Only push this user's portfolios to Supabase (not other users' data from same browser)
  const ownedByUser = all.filter((p) => p.owner === portfolio.owner);
  pushToSupabase(portfolio.owner, ownedByUser);
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
  const record = {
    id: crypto.randomUUID(),
    user_id: userId,
    occurred_at: new Date().toISOString(),
    ...entry,
  };
  log.unshift(record);
  lsSet(LS.activity, log.slice(0, 500));
  pushActivityToSupabase(record);
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
  pushSettingsToSupabase(userId, all[userId]);
  return all[userId];
}

function pushSettingsToSupabase(userId, settings) {
  if (!isSupabaseConfigured) return;
  supabase
    .from('user_portfolios')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data }) => {
      const blob = data?.data || [];
      supabase
        .from('user_portfolios')
        .upsert({ user_id: userId, data: blob, settings, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.warn('[Sync] Settings save skipped:', error.message);
          else console.info('[Sync] Settings saved to Supabase');
        })
        .catch((err) => console.warn('[Sync] Settings save rejected:', err.message));
    })
    .catch((err) => console.warn('[Sync] Settings fetch rejected:', err.message));
}

// ─── Share token helpers ───────────────────────────────────────────────────────
export async function createShareToken(userId, portfolio) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const snapshot = { ...portfolio, _sharedAt: new Date().toISOString() };

  // Always store locally first
  const shares = lsGet(LS.shares, {});
  shares[token] = snapshot;
  lsSet(LS.shares, shares);

  // Try Supabase (best-effort)
  if (isSupabaseConfigured) {
    try {
      await supabase.from('share_tokens')
        .insert({ token, owner_id: userId, portfolio_snapshot: snapshot });
    } catch { /* localStorage is the fallback */ }
  }
  return token;
}

export async function getSharedPortfolio(token) {
  // Try Supabase first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('share_tokens')
        .select('portfolio_snapshot')
        .eq('token', token)
        .maybeSingle();
      if (!error && data) return data.portfolio_snapshot;
    } catch { /* fall through */ }
  }
  const shares = lsGet(LS.shares, {});
  return shares[token] ?? null;
}

// ─── Invite helpers ──────────────────────────────────────────────────────────
// Creates an invite token. ALWAYS stores in localStorage first (guaranteed).
// Then tries Supabase as best-effort for cross-browser. Never throws.
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

  // ALWAYS store in localStorage first — this is guaranteed to work
  const invites = lsGet(LS.invites, {});
  invites[token] = invite;
  lsSet(LS.invites, invites);

  // Then TRY Supabase (best-effort, never fail)
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('invites').insert(invite);
      if (error) console.warn('[Invite] Supabase insert skipped:', error.message);
      else console.info('[Invite] Saved to Supabase');
    } catch (e) {
      console.warn('[Invite] Supabase error (using local):', e.message);
    }
  }

  return token;
}

export async function getInvite(token) {
  // Try Supabase first
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (!error && data) return sanitizeInvite(data);
    } catch { /* fall through */ }
  }
  // Fallback to localStorage
  const invites = lsGet(LS.invites, {});
  const raw = invites[token] ?? null;
  return raw ? sanitizeInvite(raw) : null;
}

export function acceptInvite(userId, invite) {
  const acceptedAt = new Date().toISOString();
  const clients = lsGet(LS.clients, {});
  // Merge portfolio_ids if the client already has some from a previous invite
  const existing = clients[userId];
  const existingPortfolioIds = existing?.portfolio_ids ?? [];
  const newPortfolioIds = invite.portfolio_ids ?? [];
  const mergedPortfolioIds = [...new Set([...existingPortfolioIds, ...newPortfolioIds])];

  clients[userId] = {
    advisor_id: invite.advisor_id,
    portfolio_ids: mergedPortfolioIds,
    accepted_at: existing?.accepted_at ?? acceptedAt,
  };
  lsSet(LS.clients, clients);

  // Update the invite's accepted_at in localStorage so getLinkedClient sees it
  if (invite.token) {
    const invites = lsGet(LS.invites, {});
    if (invites[invite.token]) {
      invites[invite.token].accepted_by = userId;
      invites[invite.token].accepted_at = invites[invite.token].accepted_at ?? acceptedAt;
      lsSet(LS.invites, invites);
    }
  }

  // Also store the portfolio snapshot in local portfolios so it's immediately available
  if (invite.portfolio_snapshot) {
    const all = lsGet(LS.portfolios, []);
    const snap = sanitizePortfolio(invite.portfolio_snapshot);
    if (snap) {
      const idx = all.findIndex((p) => p.id === snap.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...snap };
      } else {
        all.push(snap);
      }
      lsSet(LS.portfolios, all);
    }
  }

  // Persist to Supabase so it survives browser changes
  if (isSupabaseConfigured && invite.token) {
    supabase
      .from('invites')
      .update({ accepted_by: userId, accepted_at: acceptedAt })
      .eq('token', invite.token)
      .then(({ error }) => {
        if (error) console.warn('[Invite] Accept sync skipped:', error.message);
        else console.info('[Invite] Acceptance saved to Supabase');
      })
      .catch((err) => console.warn('[Invite] Accept sync rejected:', err.message));
  }

  // Also try to pull the latest version of the portfolio from the advisor's data
  if (isSupabaseConfigured && invite.advisor_id) {
    supabase
      .from('user_portfolios')
      .select('data')
      .eq('user_id', invite.advisor_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.data) {
          const advisorPortfolios = data.data;
          const linkedIds = new Set(mergedPortfolioIds);
          const all = lsGet(LS.portfolios, []);
          const withoutLinked = all.filter((p) => !linkedIds.has(p.id));
          const linkedFromAdvisor = advisorPortfolios
            .filter((p) => linkedIds.has(p.id))
            .map(sanitizePortfolio)
            .filter(Boolean);
          if (linkedFromAdvisor.length) {
            lsSet(LS.portfolios, [...withoutLinked, ...linkedFromAdvisor]);
            console.info('[Invite] Synced latest portfolio data from advisor');
          }
        }
      })
      .catch((err) => console.warn('[Invite] Advisor portfolio sync failed:', err.message));
  }
}

// ─── Email helpers ────────────────────────────────────────────────────────────
// Generic email sender via Supabase Edge Function (send-email) backed by Resend.
// Falls back gracefully when the Edge Function isn't deployed.
//
// Usage:  await sendEmail('invite', 'client@example.com', { portfolio_name: '...', invite_url: '...' })
//
// Supported types (defined in supabase/functions/send-email/index.ts):
//   'invite'           — Client invite with portfolio link
//   'welcome'          — Welcome email after signup
//   'portfolio_update' — Notify client of portfolio changes
//   'new_message'      — Notify of new message on portfolio

export async function sendEmail(type, to, data = {}) {
  if (!isSupabaseConfigured) {
    console.warn('[Email] Supabase not configured — skipping email');
    return { sent: false, reason: 'supabase_not_configured' };
  }

  try {
    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: { type, to, data },
    });

    if (error) {
      console.warn(`[Email] Edge Function error for "${type}":`, error.message);
      return { sent: false, reason: 'edge_function_error', error: error.message };
    }

    if (result?.success) {
      console.info(`[Email] Sent "${type}" email to ${to} (id: ${result.id})`);
      return { sent: true, id: result.id };
    }

    console.warn(`[Email] Edge Function returned failure for "${type}":`, result?.error);
    return { sent: false, reason: 'send_failed', error: result?.error };
  } catch (e) {
    console.warn(`[Email] Edge Function not available for "${type}":`, e.message);
    return { sent: false, reason: 'not_deployed', error: e.message };
  }
}

// Sends an invite email via Resend (Edge Function) or falls back to mailto: link.
export async function sendInviteEmail({ to, advisorEmail, portfolioName, inviteUrl }) {
  // 1) Try sending via Resend Edge Function
  const result = await sendEmail('invite', to, {
    advisor_email: advisorEmail,
    portfolio_name: portfolioName,
    invite_url: inviteUrl,
  });

  if (result.sent) return { sent: true, method: 'resend' };

  // 2) Fallback: open the user's email client with a pre-filled mailto: link
  const subject = encodeURIComponent(`You've been invited to view "${portfolioName}" on AJA Wealth Management`);
  const body = encodeURIComponent(
    `Hi,\n\nYou've been invited to view the portfolio "${portfolioName}" on AJA Wealth Management.\n\n` +
    `Click the link below to access your personalized client portal:\n${inviteUrl}\n\n` +
    `This link is unique to you. Once you sign up or log in, the portfolio will be synced to your account.\n\n` +
    `Best regards,\n${advisorEmail}`
  );
  const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
  window.open(mailtoUrl, '_blank');
  return { sent: false, method: 'mailto', mailtoUrl };
}

// ─── Message helpers ─────────────────────────────────────────────────────────
export function getMessages(portfolioId) {
  return lsGet(LS.messages, [])
    .filter((m) => m.portfolio_id === portfolioId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(sanitizeMessage);
}

// Fetch messages from Supabase for cross-browser sync. Returns sorted array or null on failure.
export async function fetchMessagesFromSupabase(portfolioId) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const supabaseMessages = data || [];
    const localMessages = lsGet(LS.messages, []).filter(m => m.portfolio_id === portfolioId);

    // Merge both directions: Supabase ↔ localStorage
    if (supabaseMessages.length) {
      const allLocal = lsGet(LS.messages, []);
      const localIds = new Set(allLocal.map((m) => m.id));
      const newFromSupabase = supabaseMessages.filter((m) => !localIds.has(m.id));
      if (newFromSupabase.length) lsSet(LS.messages, [...allLocal, ...newFromSupabase]);
    }

    // Combine both sources, deduplicate by id, Supabase wins on conflicts
    const merged = new Map();
    for (const m of localMessages) merged.set(m.id, m);
    for (const m of supabaseMessages) merged.set(m.id, m);
    return Array.from(merged.values())
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(sanitizeMessage);
  } catch {
    return null; // Fall back to localStorage via getMessages()
  }
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
  pushMessageToSupabase(msg);
  return sanitizeMessage(msg);
}

// Look up the client email linked to a portfolio (from invites)
// Returns { email, accepted } or null
export async function getLinkedClient(portfolioId) {
  // Check localStorage first
  const invites = Object.values(lsGet(LS.invites, {}));
  const match = invites.find((inv) => inv.portfolio_ids?.includes(portfolioId));
  if (match?.client_email) {
    return { email: match.client_email, accepted: !!match.accepted_at };
  }

  // Try Supabase
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('invites')
        .select('client_email, accepted_at')
        .contains('portfolio_ids', [portfolioId])
        .maybeSingle();
      if (data?.client_email) {
        return { email: data.client_email, accepted: !!data.accepted_at };
      }
    } catch { /* fall through */ }
  }
  return null;
}

export function getLatestApproval(portfolioId) {
  const raw = lsGet(LS.messages, [])
    .filter((m) => m.portfolio_id === portfolioId && (m.type === 'approval' || m.type === 'change_request'))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null;
  return sanitizeApproval(raw);
}
