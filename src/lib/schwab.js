// ─── Schwab brokerage API client ──────────────────────────────────────────────
// Follows the same pattern as finnhub.js: isConfigured() check, in-memory
// caching, and error handling.  All calls go through the server-side proxy
// at /api/schwab-proxy which keeps the client secret secure.
//
// The VITE_SCHWAB_CLIENT_ID env var is the only client-side credential needed
// (used to construct the OAuth authorization URL).

import { supabase } from './supabase';
import { logError } from './errorLogger';

const CLIENT_ID = import.meta.env.VITE_SCHWAB_CLIENT_ID;

/** True if Schwab integration is configured (client ID available). */
export const isConfigured = () => Boolean(CLIENT_ID);

/** Get the current Supabase auth token for API calls. */
async function getAuthHeaders() {
  if (!supabase) {
    console.warn('[Schwab] getAuthHeaders: supabase client is null (demo mode)');
    return {};
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.warn('[Schwab] getAuthHeaders: getSession error:', error.message);
  if (!session?.access_token) {
    console.warn('[Schwab] getAuthHeaders: no session/token available. session:', !!session);
    return {};
  }
  return { 'Authorization': `Bearer ${session.access_token}` };
}

// ── In-memory caches ─────────────────────────────────────────────────────────
const positionsCache = new Map(); // accountHash → { data, ts }
const accountsCache  = new Map(); // userId → { data, ts }
const POSITIONS_TTL  = 60_000;    // 60 s — positions don't change frequently
const ACCOUNTS_TTL   = 300_000;   // 5 min

/** Clear all Schwab caches. */
export function clearSchwabCache() {
  positionsCache.clear();
  accountsCache.clear();
}

// ── Ticker normalization ─────────────────────────────────────────────────────
// Schwab may use slightly different symbols for some instruments.
const SCHWAB_TICKER_MAP = {
  'BRK/B': 'BRK.B',
  'BF/B':  'BF.B',
};

/** Normalize a Schwab symbol to match our standard ticker format. */
export function normalizeSchwabTicker(symbol) {
  return SCHWAB_TICKER_MAP[symbol] || symbol;
}

// ── OAuth flow ───────────────────────────────────────────────────────────────

/**
 * Start the Schwab OAuth authorization flow.
 * Navigates the browser to Schwab's login page.
 * After authorization, Schwab redirects to /api/schwab-auth with a code.
 */
export function startOAuthFlow(userId, portfolioId) {
  if (!CLIENT_ID) {
    console.error('[Schwab] Cannot start OAuth — VITE_SCHWAB_CLIENT_ID not configured');
    return;
  }
  const redirectUri = `${window.location.origin}/api/schwab-auth`;
  const state = portfolioId ? `${userId}:${portfolioId}` : userId;
  const url = `https://api.schwabapi.com/v1/oauth/authorize?` +
    `client_id=${encodeURIComponent(CLIENT_ID)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `state=${encodeURIComponent(state)}`;
  window.location.href = url;
}

// ── API calls via proxy ──────────────────────────────────────────────────────

/**
 * Fetch the list of Schwab accounts for a user.
 * Returns: [{ accountNumber, hashValue }]
 */
export async function getSchwabAccounts(userId) {
  const cached = accountsCache.get(userId);
  if (cached && Date.now() - cached.ts < ACCOUNTS_TTL) return cached.data;

  const headers = await getAuthHeaders();
  const res = await fetch(`/api/schwab-proxy?action=accounts&user_id=${encodeURIComponent(userId)}`, { headers });
  if (res.status === 404) return null; // not linked
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    logError({ level: 'error', message: `Schwab accounts 401: ${body.error || 'unknown'}`, source: 'schwab', metadata: { userId, status: 401, body } });
    if (body.error === 'reauth_required') throw new Error('reauth_required');
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    logError({ level: 'error', message: `Schwab accounts fetch failed: ${res.status}`, source: 'schwab', metadata: { userId, status: res.status } });
    throw new Error(`Schwab accounts fetch failed: ${res.status}`);
  }

  const data = await res.json();
  accountsCache.set(userId, { data, ts: Date.now() });
  return data;
}

/**
 * Fetch positions for a specific Schwab account.
 * Returns: { totalValue, positions: [{ ticker, quantity, marketValue, averagePrice, actualWeight, dayPL, dayPLPercent }] }
 */
export async function getSchwabPositions(userId, accountHash) {
  const cacheKey = `${userId}:${accountHash}`;
  const cached = positionsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < POSITIONS_TTL) return cached.data;

  const headers = await getAuthHeaders();
  const res = await fetch(
    `/api/schwab-proxy?action=positions&user_id=${encodeURIComponent(userId)}&account=${encodeURIComponent(accountHash)}`,
    { headers }
  );
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    logError({ level: 'error', message: `Schwab positions 401: ${body.error || 'unknown'}`, source: 'schwab', metadata: { userId, accountHash, status: 401, body } });
    if (body.error === 'reauth_required') throw new Error('reauth_required');
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    logError({ level: 'error', message: `Schwab positions fetch failed: ${res.status}`, source: 'schwab', metadata: { userId, accountHash, status: res.status } });
    throw new Error(`Schwab positions fetch failed: ${res.status}`);
  }

  const raw = await res.json();

  // Normalize ticker symbols
  const data = {
    totalValue: raw.totalValue,
    positions: (raw.positions || []).map(p => ({
      ...p,
      ticker: normalizeSchwabTicker(p.ticker),
    })),
  };

  positionsCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

/**
 * Unlink Schwab account for a user (deletes stored tokens).
 */
export async function unlinkSchwab(userId) {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `/api/schwab-proxy?action=unlink&user_id=${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers }
  );
  if (!res.ok) throw new Error('Failed to unlink Schwab account');
  clearSchwabCache();
}

/**
 * Check if a user has a linked Schwab account by trying to fetch accounts.
 * Returns the accounts array or null if not linked.
 */
export async function checkSchwabLinked(userId) {
  try {
    return await getSchwabAccounts(userId);
  } catch (err) {
    console.warn('[Schwab] checkSchwabLinked error:', err.message);
    // Propagate reauth errors so UI can prompt re-link
    if (err.message === 'reauth_required') throw err;
    return null;
  }
}
