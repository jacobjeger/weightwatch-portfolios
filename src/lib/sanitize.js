// ─── Centralized data sanitization ──────────────────────────────────────────
// Every function that reads from localStorage or Supabase calls through these
// before returning data to React components. This eliminates React error #310
// ("Objects are not valid as a React child") by ensuring all values are primitives.

export function sanitizeHolding(h) {
  if (!h || typeof h !== 'object') return null;
  return {
    ticker: typeof h.ticker === 'string' ? h.ticker : String(h.ticker ?? ''),
    name: typeof h.name === 'string' ? h.name : String(h.name ?? ''),
    type: typeof h.type === 'string' ? h.type : 'Stock',
    category: typeof h.category === 'string' ? h.category : 'Core',
    weight_percent: Number(h.weight_percent) || 0,
    last_price: Number(h.last_price) || 0,
    entry_price: h.entry_price != null ? Number(h.entry_price) || 0 : undefined,
  };
}

export function sanitizePortfolio(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: typeof p.id === 'string' ? p.id : String(p.id ?? ''),
    name: typeof p.name === 'string' ? p.name : 'Portfolio',
    description: typeof p.description === 'string' ? p.description : '',
    owner: typeof p.owner === 'string' ? p.owner : String(p.owner ?? ''),
    primary_benchmark: typeof p.primary_benchmark === 'string' ? p.primary_benchmark : null,
    starting_value: Number(p.starting_value) || 0,
    cash_percent: Number(p.cash_percent) || 0,
    drip_enabled: Boolean(p.drip_enabled),
    created_at: typeof p.created_at === 'string' ? p.created_at : null,
    last_updated_at: typeof p.last_updated_at === 'string' ? p.last_updated_at : null,
    holdings: Array.isArray(p.holdings)
      ? p.holdings.map(sanitizeHolding).filter(Boolean)
      : [],
  };
}

export function sanitizeMessage(m) {
  if (!m || typeof m !== 'object') return null;
  return {
    id: typeof m.id === 'string' ? m.id : String(m.id ?? ''),
    portfolio_id: typeof m.portfolio_id === 'string' ? m.portfolio_id : String(m.portfolio_id ?? ''),
    type: typeof m.type === 'string' ? m.type : '',
    text: typeof m.text === 'string' ? m.text : '',
    sender: typeof m.sender === 'string' ? m.sender : '',
    sender_id: typeof m.sender_id === 'string' ? m.sender_id : String(m.sender_id ?? ''),
    sender_email: typeof m.sender_email === 'string' ? m.sender_email : '',
    sender_role: typeof m.sender_role === 'string' ? m.sender_role : '',
    created_at: typeof m.created_at === 'string' ? m.created_at : '',
  };
}

export function sanitizeApproval(a) {
  if (!a || typeof a !== 'object') return null;
  if (typeof a.type !== 'string') return null;
  return {
    type: a.type,
    text: typeof a.text === 'string' ? a.text : '',
    created_at: typeof a.created_at === 'string' ? a.created_at : '',
    sender_email: typeof a.sender_email === 'string' ? a.sender_email : '',
    portfolio_id: typeof a.portfolio_id === 'string' ? a.portfolio_id : String(a.portfolio_id ?? ''),
  };
}

export function sanitizeInvite(inv) {
  if (!inv || typeof inv !== 'object') return null;
  return {
    token: typeof inv.token === 'string' ? inv.token : String(inv.token ?? ''),
    advisor_id: typeof inv.advisor_id === 'string' ? inv.advisor_id : String(inv.advisor_id ?? ''),
    client_email: typeof inv.client_email === 'string' ? inv.client_email : '',
    portfolio_ids: Array.isArray(inv.portfolio_ids)
      ? inv.portfolio_ids.map((id) => (typeof id === 'string' ? id : String(id ?? '')))
      : [],
    portfolio_snapshot: inv.portfolio_snapshot ? sanitizePortfolio(inv.portfolio_snapshot) : null,
    accepted_by: typeof inv.accepted_by === 'string' ? inv.accepted_by : (inv.accepted_by ? String(inv.accepted_by) : null),
    accepted_at: typeof inv.accepted_at === 'string' ? inv.accepted_at : null,
    created_at: typeof inv.created_at === 'string' ? inv.created_at : '',
  };
}
