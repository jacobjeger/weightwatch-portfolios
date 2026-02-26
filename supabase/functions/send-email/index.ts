// ─── Generic email sender via Resend ─────────────────────────────────────────
// Supabase Edge Function that sends emails through the Resend API.
//
// Supports multiple email types via the `type` field — add new templates below.
//
// Setup:
//   1. Get an API key from https://resend.com
//   2. Verify your sending domain in the Resend dashboard
//   3. Set the secret:  supabase secrets set RESEND_API_KEY=re_xxxxx
//   4. Set sender:      supabase secrets set RESEND_FROM="AJA Wealth Management <noreply@yourdomain.com>"
//   5. Deploy:          supabase functions deploy send-email
//
// Usage from client:
//   supabase.functions.invoke('send-email', { body: { type: 'invite', to: '...', data: { ... } } })

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API = 'https://api.resend.com/emails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Email templates ──────────────────────────────────────────────────────────
// Each template returns { subject, html } given the data payload.
// Add new email types here as your app grows.

const templates: Record<string, (data: Record<string, string>) => { subject: string; html: string }> = {

  // Client invite email
  invite: (data) => ({
    subject: `You've been invited to view "${data.portfolio_name}" on AJA Wealth Management`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1e293b; font-size: 22px; margin: 0;">AJA Wealth Management</h1>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hi,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          <strong>${data.advisor_email}</strong> has invited you to view the portfolio
          <strong>"${data.portfolio_name}"</strong> on AJA Wealth Management.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.invite_url}"
             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Portfolio
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          This link is unique to you. Once you sign up or log in, the portfolio will be synced to your client account.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          AJA Wealth Management &middot; Portfolio management for advisors and their clients
        </p>
      </div>
    `,
  }),

  // Welcome email (for future use)
  welcome: (data) => ({
    subject: 'Welcome to AJA Wealth Management',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1e293b; font-size: 22px; margin: 0;">Welcome to AJA Wealth Management</h1>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Hi ${data.email},
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Your ${data.account_type} account is ready. ${data.account_type === 'advisor'
            ? 'Start building and managing portfolios for your clients.'
            : 'Your advisor can now share portfolios with you.'}
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.app_url}"
             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Open App
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          AJA Wealth Management &middot; Portfolio management for advisors and their clients
        </p>
      </div>
    `,
  }),

  // Portfolio update notification (for future use)
  portfolio_update: (data) => ({
    subject: `Portfolio "${data.portfolio_name}" has been updated`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1e293b; font-size: 22px; margin: 0;">Portfolio Updated</h1>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Your advisor has made changes to <strong>"${data.portfolio_name}"</strong>.
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          ${data.change_summary || 'Log in to see the latest updates.'}
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.app_url}"
             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Portfolio
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          AJA Wealth Management &middot; Portfolio management for advisors and their clients
        </p>
      </div>
    `,
  }),

  // New message notification (for future use)
  new_message: (data) => ({
    subject: `New message on "${data.portfolio_name}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1e293b; font-size: 22px; margin: 0;">New Message</h1>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          <strong>${data.sender_email}</strong> sent a message on <strong>"${data.portfolio_name}"</strong>:
        </p>
        <div style="background: #f8fafc; border-left: 3px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0;">
            "${data.message_preview}"
          </p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.app_url}"
             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Reply
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          AJA Wealth Management &middot; Portfolio management for advisors and their clients
        </p>
      </div>
    `,
  }),
};

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'AJA Wealth Management <onboarding@resend.dev>';

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { type, to, data } = await req.json();

    // Validate required fields
    if (!type || !to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: type, to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Look up the template
    const template = templates[type];
    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown email type: ${type}. Available: ${Object.keys(templates).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { subject, html } = template(data || {});

    // Send via Resend API
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('[send-email] Resend error:', result);
      return new Response(
        JSON.stringify({ success: false, error: result.message || 'Resend API error' }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[send-email] Sent "${type}" email to ${to} (id: ${result.id})`);
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[send-email] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
