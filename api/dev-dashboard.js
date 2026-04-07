// ─── Vercel serverless: Dev Dashboard API ─────────────────────────────────────
// Provides cross-user read access for the developer dashboard.
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
//
// Actions (all GET):
//   ?action=error-logs&limit=50&offset=0&source=&level=&search=
//   ?action=users
//   ?action=schwab-tokens
//   ?action=activity-log&limit=100&offset=0&user_id=&action_type=&date_from=&date_to=

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

const allowedOrigin = process.env.CORS_ORIGIN || 'https://www.ajawealthmanagement.com';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  const { action } = req.query;

  try {
    // ── Error Logs ──────────────────────────────────────────────────────────
    if (action === 'error-logs') {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const { source, level, search } = req.query;

      // Main query
      let query = supabase
        .from('error_logs')
        .select('*, profiles!error_logs_user_id_fkey(email)', { count: 'exact' })
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (source) query = query.eq('source', source);
      if (level) query = query.eq('level', level);
      if (search) query = query.ilike('message', `%${search}%`);

      const { data: logs, count, error: logsErr } = await query;
      if (logsErr) {
        // If join fails (no FK), query without join
        let fallbackQuery = supabase
          .from('error_logs')
          .select('*', { count: 'exact' })
          .order('last_seen_at', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);
        if (source) fallbackQuery = fallbackQuery.eq('source', source);
        if (level) fallbackQuery = fallbackQuery.eq('level', level);
        if (search) fallbackQuery = fallbackQuery.ilike('message', `%${search}%`);
        const { data: fbLogs, count: fbCount } = await fallbackQuery;
        return res.status(200).json({ logs: fbLogs || [], count: fbCount || 0, dailyCounts: [], topErrors: [], sourceCounts: [] });
      }

      // Daily error counts (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: recentErrors } = await supabase
        .from('error_logs')
        .select('created_at, occurrence_count')
        .gte('created_at', thirtyDaysAgo);

      const dailyMap = {};
      (recentErrors || []).forEach(e => {
        const day = e.created_at?.slice(0, 10);
        if (day) dailyMap[day] = (dailyMap[day] || 0) + (e.occurrence_count || 1);
      });
      const dailyCounts = Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top 10 errors by occurrence
      const { data: topErrors } = await supabase
        .from('error_logs')
        .select('message, source, occurrence_count')
        .order('occurrence_count', { ascending: false })
        .limit(10);

      // Counts by source
      const { data: allSources } = await supabase
        .from('error_logs')
        .select('source, occurrence_count');
      const sourceMap = {};
      (allSources || []).forEach(e => {
        sourceMap[e.source] = (sourceMap[e.source] || 0) + (e.occurrence_count || 1);
      });
      const sourceCounts = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));

      return res.status(200).json({
        logs: logs || [],
        count: count || 0,
        dailyCounts,
        topErrors: topErrors || [],
        sourceCounts,
      });
    }

    // ── Users ───────────────────────────────────────────────────────────────
    if (action === 'users') {
      const [profilesRes, schwabRes, invitesRes, portfoliosRes] = await Promise.all([
        supabase.from('profiles').select('id, email, created_at').order('created_at', { ascending: false }),
        supabase.from('schwab_tokens').select('user_id'),
        supabase.from('invites').select('accepted_by').not('accepted_by', 'is', null),
        supabase.from('user_portfolios').select('user_id, data'),
      ]);

      const schwabUsers = new Set((schwabRes.data || []).map(r => r.user_id));
      const clientUsers = new Set((invitesRes.data || []).map(r => r.accepted_by));

      const users = (profilesRes.data || []).map(p => {
        let portfolioCount = 0;
        const up = (portfoliosRes.data || []).find(r => r.user_id === p.id);
        if (up?.data) {
          try {
            const parsed = typeof up.data === 'string' ? JSON.parse(up.data) : up.data;
            portfolioCount = Array.isArray(parsed) ? parsed.length : 0;
          } catch { portfolioCount = 0; }
        }
        return {
          id: p.id,
          email: p.email,
          created_at: p.created_at,
          role: clientUsers.has(p.id) ? 'client' : 'advisor',
          portfolio_count: portfolioCount,
          schwab_linked: schwabUsers.has(p.id),
        };
      });

      return res.status(200).json({ users });
    }

    // ── Schwab Tokens ───────────────────────────────────────────────────────
    if (action === 'schwab-tokens') {
      // CRITICAL: Never return access_token or refresh_token
      const { data: tokens, error: tokErr } = await supabase
        .from('schwab_tokens')
        .select('user_id, linked_at, expires_at, updated_at, schwab_accounts')
        .order('updated_at', { ascending: false });

      if (tokErr) return res.status(500).json({ error: tokErr.message });

      // Get emails for user_ids
      const userIds = (tokens || []).map(t => t.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds.length ? userIds : ['__none__']);

      const emailMap = {};
      (profiles || []).forEach(p => { emailMap[p.id] = p.email; });

      const enriched = (tokens || []).map(t => ({
        ...t,
        email: emailMap[t.user_id] || t.user_id,
      }));

      return res.status(200).json({ tokens: enriched });
    }

    // ── Activity Log ────────────────────────────────────────────────────────
    if (action === 'activity-log') {
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const offset = parseInt(req.query.offset) || 0;
      const { user_id: filterUserId, action_type, date_from, date_to } = req.query;

      let query = supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('occurred_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filterUserId) query = query.eq('user_id', filterUserId);
      if (action_type) query = query.eq('action_type', action_type);
      if (date_from) query = query.gte('occurred_at', date_from);
      if (date_to) query = query.lte('occurred_at', `${date_to}T23:59:59`);

      const { data: logs, count, error: logErr } = await query;
      if (logErr) return res.status(500).json({ error: logErr.message });

      // Get emails and distinct values for filters
      const userIds = [...new Set((logs || []).map(l => l.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds.length ? userIds : ['__none__']);
      const emailMap = {};
      (profiles || []).forEach(p => { emailMap[p.id] = p.email; });

      const enriched = (logs || []).map(l => ({
        ...l,
        email: emailMap[l.user_id] || l.user_id,
      }));

      // Get distinct action types for filter dropdown
      const { data: actionTypes } = await supabase
        .from('activity_log')
        .select('action_type')
        .limit(100);
      const uniqueActions = [...new Set((actionTypes || []).map(a => a.action_type).filter(Boolean))].sort();

      // Get all users for filter dropdown
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email')
        .order('email');

      return res.status(200).json({
        logs: enriched,
        count: count || 0,
        actionTypes: uniqueActions,
        users: (allProfiles || []).map(p => ({ id: p.id, email: p.email })),
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[dev-dashboard] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
