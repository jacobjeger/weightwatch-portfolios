import { supabase, isSupabaseConfigured } from './supabase';

const MAX_QUEUE = 50;
const FLUSH_INTERVAL = 5_000; // 5s
const DEBOUNCE_MS = 2_000; // deduplicate rapid-fire same errors
const queue = [];
let flushing = false;
let initialized = false;
let recentFingerprints = new Map(); // fingerprint → timestamp

function fingerprint(message, source) {
  const str = `${source || ''}:${(message || '').replace(/\d+/g, 'N').slice(0, 200)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Queue an error for logging. Deduplicates rapid-fire identical errors.
 */
export function logError({
  level = 'error',
  message,
  stack,
  component,
  source,
  metadata,
  userId,
  url,
}) {
  const fp = fingerprint(message, source);
  const now = Date.now();
  const lastSeen = recentFingerprints.get(fp);
  if (lastSeen && now - lastSeen < DEBOUNCE_MS) return; // skip duplicate
  recentFingerprints.set(fp, now);

  // Cleanup old fingerprints
  if (recentFingerprints.size > 100) {
    for (const [k, t] of recentFingerprints) {
      if (now - t > 30_000) recentFingerprints.delete(k);
    }
  }

  const entry = {
    level,
    message: String(message || '').slice(0, 2000),
    stack: String(stack || '').slice(0, 5000),
    component: component || null,
    source: source || 'manual',
    metadata: metadata ? JSON.stringify(metadata).slice(0, 5000) : null,
    user_id: userId || null,
    url: url || (typeof window !== 'undefined' ? window.location.href : null),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };

  queue.push(entry);
  if (queue.length > MAX_QUEUE) queue.shift();
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  const batch = queue.splice(0, queue.length);
  try {
    // Send to API endpoint which handles DB storage + email
    await fetch('/api/error-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: batch }),
    });
  } catch {
    // Push back on failure — but cap size
    if (queue.length < MAX_QUEUE) {
      queue.push(...batch.slice(0, MAX_QUEUE - queue.length));
    }
  } finally {
    flushing = false;
  }
}

/**
 * Install global error handlers. Call once at app startup.
 */
export function initErrorLogging() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Unhandled JS errors
  window.addEventListener('error', (event) => {
    logError({
      level: 'error',
      message: event.message,
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      source: 'unhandled',
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    logError({
      level: 'error',
      message: err?.message || String(err),
      stack: err?.stack || '',
      source: 'promise',
    });
  });

  // Intercept console.error
  const originalError = console.error;
  console.error = (...args) => {
    originalError.apply(console, args);
    const msg = args.map(a => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    // Skip our own flush logs and noisy React dev warnings
    if (msg.includes('[errorLogger]') || msg.includes('Download the React DevTools')) return;
    logError({
      level: 'error',
      message: msg.slice(0, 2000),
      stack: args.find(a => a instanceof Error)?.stack || '',
      source: 'console',
    });
  };

  // Flush periodically
  setInterval(flush, FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/**
 * Log a React ErrorBoundary catch — flushes immediately.
 */
export function logReactError(error, errorInfo, userId) {
  logError({
    level: 'error',
    message: error?.message || String(error),
    stack: error?.stack || '',
    component: errorInfo?.componentStack?.slice(0, 2000) || '',
    source: 'react',
    userId,
  });
  flush();
}

/**
 * Fetch error logs from Supabase (for the dashboard).
 */
export async function getErrorLogs({ limit = 100, offset = 0, level, source } = {}) {
  if (!isSupabaseConfigured || !supabase) return { data: [], count: 0 };

  let query = supabase
    .from('error_logs')
    .select('*', { count: 'exact' })
    .order('last_seen_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (level) query = query.eq('level', level);
  if (source) query = query.eq('source', source);

  const { data, count, error } = await query;
  if (error) {
    console.warn('[errorLogger] fetch failed:', error.message);
    return { data: [], count: 0 };
  }
  return { data: data || [], count: count || 0 };
}

/**
 * Delete a specific error log entry.
 */
export async function deleteErrorLog(id) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('error_logs').delete().eq('id', id);
}

/**
 * Clear all error logs.
 */
export async function clearAllErrorLogs() {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
