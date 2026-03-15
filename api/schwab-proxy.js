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
    const body = await res.text();
    console.error('[schwab-proxy] Token refresh failed:', res.status, body);
    return null; // caller should return reauth_required
  }

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString();

  await supabase
    .from('schwab_tokens')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', row.user_id);

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
        return res.status(resp.status).json({ error: `Schwab API error: ${resp.status}` });
      }
      const accounts = await resp.json();

      // Cache account list in DB
      await supabase
        .from('schwab_tokens')
        .update({ schwab_accounts: accounts, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

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
        return res.status(resp.status).json({ error: `Schwab API error: ${resp.status}` });
      }
      const data = await resp.json();

      // Normalize into a simpler format for the client
      const acct = data.securitiesAccount || data;
      const positions = (acct.positions || []).map(pos => ({
        ticker: pos.instrument?.symbol,
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
    return res.status(500).json({ error: err.message });
  }
}
