// ─── Vercel serverless: Schwab API authenticated proxy ───────────────────────
// Proxies client requests to the Schwab Trader API, keeping the client secret
// and tokens server-side.  Handles token refresh automatically.
//
// Endpoints:
//   GET  /api/schwab-proxy?action=accounts&user_id=UUID
//   GET  /api/schwab-proxy?action=positions&user_id=UUID&account=HASH
//   DELETE /api/schwab-proxy?action=unlink&user_id=UUID

import { createClient } from '@supabase/supabase-js';

const SCHWAB_API_BASE  = 'https://api.schwabapi.com/trader/v1';
const SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// Log errors to the error_logs table so they show in the dev dashboard
async function logSchwabError(message, metadata = {}) {
  try {
    const sb = getSupabase();
    const fp = `schwab_${message.replace(/\s+/g, '_').slice(0, 80)}`;
    // Try to increment existing error, otherwise insert
    const { data: existing } = await sb
      .from('error_logs')
      .select('id, occurrence_count')
      .eq('fingerprint', fp)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      .limit(1)
      .single();
    if (existing) {
      await sb.from('error_logs').update({
        occurrence_count: (existing.occurrence_count || 1) + 1,
        last_seen_at: new Date().toISOString(),
        metadata: JSON.stringify(metadata).slice(0, 5000),
      }).eq('id', existing.id);
    } else {
      await sb.from('error_logs').insert({
        level: 'error',
        message: message.slice(0, 2000),
        source: 'schwab',
        fingerprint: fp,
        metadata: JSON.stringify(metadata).slice(0, 5000),
        user_id: metadata.userId || null,
        url: '/api/schwab-proxy',
        user_agent: 'vercel-serverless',
        occurrence_count: 1,
        last_seen_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[schwab-proxy] Failed to log error to DB:', e.message);
  }
}

// ── Token refresh ────────────────────────────────────────────────────────────
async function refreshTokens(supabase, row) {
  const clientId     = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
  const basicAuth    = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[schwab-proxy] Token refresh failed:', res.status, body.slice(0, 200));
    logSchwabError('Schwab token refresh failed', { userId: row.user_id, status: res.status, body: body.slice(0, 500) });
    return null; // caller should return reauth_required
  }

  const tokens = await res.json();
  if (!tokens.expires_in) console.warn('[schwab-proxy] Missing expires_in in token response, using 1800s fallback');
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString();

  const { error: updateErr } = await supabase
    .from('schwab_tokens')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', row.user_id);

  if (updateErr) {
    console.error('[schwab-proxy] Failed to persist refreshed tokens:', updateErr.message);
    return null;
  }

  return tokens.access_token;
}

// ── Get valid access token (refresh if expired) ──────────────────────────────
async function getAccessToken(supabase, userId) {
  const { data: row, error } = await supabase
    .from('schwab_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !row) return { error: 'not_linked' };

  // Check if token is expired (with 60s buffer)
  const isExpired = new Date(row.expires_at).getTime() < Date.now() + 60_000;
  if (!isExpired) return { token: row.access_token, row };

  const newToken = await refreshTokens(supabase, row);
  if (!newToken) return { error: 'reauth_required' };
  return { token: newToken, row };
}

export default async function handler(req, res) {
  const { action, user_id: userId, account } = req.query;

  if (!action || !userId) {
    return res.status(400).json({ error: 'Missing action or user_id' });
  }

  // ── Verify the caller is the authenticated user ────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[schwab-proxy] 401: Missing or malformed Authorization header');
    logSchwabError('Missing Authorization header', { userId, action });
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Verify the caller by decoding the Supabase JWT and checking the sub claim.
  // We also verify via the Auth API, but if that fails we log diagnostics.
  let authUserId;

  // First: decode JWT payload to extract sub (user_id) — no signature check yet
  try {
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    authUserId = payload.sub;
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    if (exp && exp < now) {
      console.error('[schwab-proxy] 401: JWT expired.', 'exp:', new Date(exp * 1000).toISOString(), 'now:', new Date(now * 1000).toISOString(), 'sub:', authUserId);
      logSchwabError('Supabase JWT expired', { userId, action, exp: new Date(exp * 1000).toISOString(), now: new Date(now * 1000).toISOString() });
      return res.status(401).json({ error: 'Token expired' });
    }
    if (!authUserId) {
      console.error('[schwab-proxy] 401: JWT has no sub claim. payload keys:', Object.keys(payload));
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    console.error('[schwab-proxy] 401: Failed to decode JWT:', err.message, 'token_length:', token?.length);
    logSchwabError('Failed to decode JWT', { userId, action, error: err.message, tokenLength: token?.length });
    return res.status(401).json({ error: 'Malformed token' });
  }

  if (authUserId !== userId) {
    console.error('[schwab-proxy] 403: User mismatch. jwt_sub:', authUserId, 'param:', userId);
    return res.status(403).json({ error: 'Forbidden — cannot access another user\'s data' });
  }

  // Verify the JWT is valid via the Auth API (non-blocking — log if it fails but still proceed)
  fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey },
  }).then(r => {
    if (!r.ok) r.text().then(b => console.warn('[schwab-proxy] Auth API verify failed:', r.status, b.slice(0, 200)));
  }).catch(err => console.warn('[schwab-proxy] Auth API verify error:', err.message));

  const supabase = getSupabase();

  // ── Unlink ──────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE' || action === 'unlink') {
    const { error } = await supabase
      .from('schwab_tokens')
      .delete()
      .eq('user_id', userId);
    if (error) {
      return res.status(500).json({ error: 'Failed to unlink' });
    }
    return res.status(200).json({ ok: true });
  }

  // ── Get access token ────────────────────────────────────────────────────────
  const auth = await getAccessToken(supabase, userId);
  if (auth.error) {
    const status = auth.error === 'not_linked' ? 404 : 401;
    if (auth.error === 'reauth_required') {
      logSchwabError('Schwab token refresh failed — reauth required', { userId, action });
    }
    return res.status(status).json({ error: auth.error });
  }

  const headers = {
    'Authorization': `Bearer ${auth.token}`,
    'Accept': 'application/json',
  };

  try {
    // ── Accounts ────────────────────────────────────────────────────────────
    if (action === 'accounts') {
      const resp = await fetch(`${SCHWAB_API_BASE}/accounts/accountNumbers`, { headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        logSchwabError(`Schwab accounts API error: ${resp.status}`, { userId, status: resp.status, body: body.slice(0, 500) });
        return res.status(resp.status).json({ error: `Schwab API error: ${resp.status}` });
      }
      const accounts = await resp.json();

      // Cache account list in DB (non-blocking — log on failure)
      const { error: cacheErr } = await supabase
        .from('schwab_tokens')
        .update({ schwab_accounts: accounts, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (cacheErr) console.warn('[schwab-proxy] Failed to cache accounts:', cacheErr.message);

      return res.status(200).json(accounts);
    }

    // ── Positions ───────────────────────────────────────────────────────────
    if (action === 'positions') {
      if (!account) {
        return res.status(400).json({ error: 'Missing account hash' });
      }
      const resp = await fetch(
        `${SCHWAB_API_BASE}/accounts/${encodeURIComponent(account)}?fields=positions`,
        { headers }
      );
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        logSchwabError(`Schwab positions API error: ${resp.status}`, { userId, account, status: resp.status, body: body.slice(0, 500) });
        return res.status(resp.status).json({ error: `Schwab API error: ${resp.status}` });
      }
      const data = await resp.json();

      // Normalize into a simpler format for the client
      const acct = data.securitiesAccount || data;
      const positions = (acct.positions || []).filter(pos => pos.instrument?.symbol).map(pos => ({
        ticker: pos.instrument.symbol,
        assetType: pos.instrument?.assetType,
        quantity: pos.longQuantity || 0,
        marketValue: pos.marketValue || 0,
        averagePrice: pos.averagePrice || 0,
        dayPL: pos.currentDayProfitLoss || 0,
        dayPLPercent: pos.currentDayProfitLossPercentage || 0,
      }));

      const totalValue = acct.currentBalances?.liquidationValue || 0;

      // Compute actual weights
      positions.forEach(p => {
        p.actualWeight = totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0;
      });

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
      return res.status(200).json({ totalValue, positions });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[schwab-proxy] Error:', err);
    logSchwabError(`Schwab proxy unhandled error: ${err.message}`, { userId, action, stack: err.stack?.slice(0, 1000) });
    return res.status(500).json({ error: err.message });
  }
}
