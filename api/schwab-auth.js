// ─── Vercel serverless: Schwab OAuth callback ────────────────────────────────
// Handles the redirect from Schwab after the user authorizes.
// Exchanges the authorization code for access + refresh tokens,
// stores them in the Supabase `schwab_tokens` table, then redirects
// the browser back to the app.
//
// Flow:  Schwab → /api/schwab-auth?code=XXX&state=userId → token exchange → redirect to app

import { createClient } from '@supabase/supabase-js';

const SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  const clientId     = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
  const redirectUri  = process.env.SCHWAB_REDIRECT_URI;
  const supabaseUrl  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured — missing Schwab or Supabase env vars' });
  }

  // state = "userId" or "userId:portfolioId" — validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [userId, portfolioId] = state.split(':');
  if (!userId || !UUID_RE.test(userId)) {
    return res.redirect(`/?schwab_error=invalid_state`);
  }
  if (portfolioId && !UUID_RE.test(portfolioId)) {
    return res.redirect(`/?schwab_error=invalid_state`);
  }

  // Exchange authorization code for tokens
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenRes = await fetch(SCHWAB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[schwab-auth] Token exchange failed:', tokenRes.status);
      return res.redirect(`/?schwab_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString();

    // Store tokens in Supabase using service-role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: dbError } = await supabase
      .from('schwab_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('[schwab-auth] DB upsert failed:', dbError);
      return res.redirect(`/?schwab_error=db_error`);
    }

    // Redirect back to the app — include portfolio context if available
    const returnPath = portfolioId
      ? `/portfolio/${portfolioId}?schwab_linked=true`
      : `/?schwab_linked=true`;
    return res.redirect(returnPath);
  } catch (err) {
    console.error('[schwab-auth] Error:', err);
    return res.redirect(`/?schwab_error=unexpected`);
  }
}
