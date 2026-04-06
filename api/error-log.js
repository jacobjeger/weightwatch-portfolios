// ─── Vercel serverless endpoint for error logging + email alerts ──────────────
// Receives client-side errors, stores in Supabase error_logs table,
// and sends email notification to the admin.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = 'akivajeger@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const allowedOrigin = process.env.CORS_ORIGIN || 'https://www.ajawealthmanagement.com';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { errors } = req.body || {};
  if (!Array.isArray(errors) || !errors.length) {
    return res.status(400).json({ error: 'Missing errors array' });
  }

  // Store in Supabase
  let stored = false;
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // For each error, try to increment an existing grouped error or insert new
      for (const err of errors) {
        const fingerprint = generateFingerprint(err.message, err.source);

        // Try to find existing error with same fingerprint in last 24h
        const { data: existing } = await supabase
          .from('error_logs')
          .select('id, occurrence_count')
          .eq('fingerprint', fingerprint)
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          // Increment count and update last_seen
          await supabase
            .from('error_logs')
            .update({
              occurrence_count: (existing[0].occurrence_count || 1) + 1,
              last_seen_at: new Date().toISOString(),
              // Update metadata with latest info
              metadata: err.metadata || null,
              user_id: err.user_id || null,
            })
            .eq('id', existing[0].id);
        } else {
          // Insert new error
          await supabase.from('error_logs').insert({
            level: err.level || 'error',
            message: String(err.message || '').slice(0, 2000),
            stack: String(err.stack || '').slice(0, 5000),
            component: err.component || null,
            source: err.source || 'manual',
            metadata: err.metadata || null,
            user_id: err.user_id || null,
            url: err.url || null,
            user_agent: err.user_agent || null,
            fingerprint,
            occurrence_count: 1,
            last_seen_at: new Date().toISOString(),
          });
        }
      }
      stored = true;
    } catch (e) {
      console.error('[error-log] Supabase insert failed:', e.message);
    }
  }

  // Send email notification for new errors (not just increments)
  if (RESEND_API_KEY) {
    try {
      const errorSummary = errors.map(e => formatErrorForEmail(e)).join('\n\n---\n\n');
      const subject = `[AJA Wealth] ${errors.length === 1 ? errors[0].message?.slice(0, 80) : `${errors.length} errors`}`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AJA Wealth Errors <errors@ajawealthmanagement.com>',
          to: [ADMIN_EMAIL],
          subject: subject.slice(0, 200),
          html: buildEmailHTML(errors),
        }),
      });
    } catch (e) {
      console.error('[error-log] Email send failed:', e.message);
    }
  }

  return res.status(200).json({ stored, count: errors.length });
}

function generateFingerprint(message, source) {
  // Simple hash of message + source to group identical errors
  const str = `${source || ''}:${(message || '').replace(/\d+/g, 'N').slice(0, 200)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

function formatErrorForEmail(err) {
  return [
    `**${err.level?.toUpperCase() || 'ERROR'}** — ${err.source || 'unknown'}`,
    `Message: ${err.message}`,
    err.url ? `URL: ${err.url}` : null,
    err.user_id ? `User: ${err.user_id}` : null,
    err.stack ? `Stack:\n${err.stack.slice(0, 1000)}` : null,
    err.component ? `Component:\n${err.component.slice(0, 500)}` : null,
  ].filter(Boolean).join('\n');
}

function buildEmailHTML(errors) {
  const rows = errors.map(err => `
    <div style="margin-bottom:24px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-family:monospace;font-size:13px;">
      <div style="margin-bottom:8px;">
        <span style="background:#ef4444;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">
          ${escapeHtml(err.level?.toUpperCase() || 'ERROR')}
        </span>
        <span style="margin-left:8px;color:#6b7280;font-size:11px;">
          ${escapeHtml(err.source || 'unknown')} · ${new Date().toLocaleString()}
        </span>
      </div>
      <div style="font-weight:bold;color:#991b1b;margin-bottom:8px;">
        ${escapeHtml(err.message || 'Unknown error')}
      </div>
      ${err.url ? `<div style="color:#6b7280;font-size:12px;margin-bottom:4px;">URL: ${escapeHtml(err.url)}</div>` : ''}
      ${err.user_id ? `<div style="color:#6b7280;font-size:12px;margin-bottom:4px;">User: ${escapeHtml(err.user_id)}</div>` : ''}
      ${err.stack ? `<pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;overflow-x:auto;font-size:11px;margin-top:8px;">${escapeHtml(err.stack.slice(0, 1500))}</pre>` : ''}
      ${err.component ? `<pre style="background:#f1f5f9;color:#475569;padding:8px;border-radius:6px;font-size:11px;margin-top:8px;">Component Stack:\n${escapeHtml(err.component.slice(0, 500))}</pre>` : ''}
      ${err.user_agent ? `<div style="color:#9ca3af;font-size:10px;margin-top:8px;">UA: ${escapeHtml(err.user_agent.slice(0, 200))}</div>` : ''}
    </div>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="color:#1e293b;margin:0;">AJA Wealth Management</h2>
        <p style="color:#ef4444;font-weight:600;margin:4px 0 0;">Error Report</p>
      </div>
      ${rows}
      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <a href="https://www.ajawealthmanagement.com/error-logs" style="color:#3b82f6;font-size:13px;">
          View Error Dashboard →
        </a>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
