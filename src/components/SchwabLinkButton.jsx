import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Link2, Unlink, ChevronDown } from 'lucide-react';
import {
  isConfigured,
  startOAuthFlow,
  checkSchwabLinked,
  getSchwabAccounts,
  getSchwabPositions,
  unlinkSchwab,
  clearSchwabCache,
} from '../lib/schwab';
import ConfirmModal from './ConfirmModal';

/**
 * SchwabLinkButton — shows link/unlink UI and manages Schwab account selection.
 *
 * Props:
 *   userId         — current user id
 *   portfolioId    — current portfolio id
 *   schwabAccountHash — currently linked account hash (from portfolio)
 *   onAccountLinked(accountHash)  — called when user picks an account
 *   onAccountUnlinked()           — called when user unlinks
 *   onPositionsLoaded({ totalValue, positions }) — called when positions arrive
 */
export default function SchwabLinkButton({
  userId,
  portfolioId,
  schwabAccountHash,
  onAccountLinked,
  onAccountUnlinked,
  onPositionsLoaded,
}) {
  const [accounts, setAccounts] = useState(null);    // Schwab accounts list
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState(null);

  if (!isConfigured()) return null;

  // Check Schwab link status on mount
  useEffect(() => {
    if (!userId) return;
    checkSchwabLinked(userId).then(accts => {
      if (accts && accts.length > 0) setAccounts(accts);
    });
  }, [userId]);

  // Fetch positions when we have a linked account
  const fetchPositions = useCallback(async () => {
    if (!schwabAccountHash || !userId) return;
    setSyncing(true);
    setError(null);
    try {
      const data = await getSchwabPositions(userId, schwabAccountHash);
      onPositionsLoaded?.(data);
      setLastSynced(new Date());
    } catch (err) {
      if (err.message === 'reauth_required') {
        setError('Schwab session expired — please re-link');
      } else {
        setError('Failed to fetch Schwab positions');
      }
      console.warn('[Schwab] Position fetch error:', err.message);
    } finally {
      setSyncing(false);
    }
  }, [schwabAccountHash, userId, onPositionsLoaded]);

  // Auto-fetch positions when account is linked
  useEffect(() => {
    if (schwabAccountHash) fetchPositions();
  }, [schwabAccountHash, fetchPositions]);

  // Find linked account info
  const linkedAccount = accounts?.find(a => a.hashValue === schwabAccountHash);
  const accountSuffix = linkedAccount?.accountNumber
    ? `...${linkedAccount.accountNumber.slice(-4)}`
    : null;

  function handleLinkClick() {
    if (accounts && accounts.length > 0) {
      // Already authenticated — show account picker
      if (accounts.length === 1) {
        onAccountLinked?.(accounts[0].hashValue);
      } else {
        setShowPicker(true);
      }
    } else {
      // Start OAuth
      startOAuthFlow(userId, portfolioId);
    }
  }

  async function handleUnlink() {
    try {
      await unlinkSchwab(userId);
      setAccounts(null);
      onAccountUnlinked?.();
      setShowUnlink(false);
      setLastSynced(null);
    } catch {
      setError('Failed to unlink');
    }
  }

  function handleRefresh() {
    clearSchwabCache();
    fetchPositions();
  }

  // ── Not linked to this portfolio ──────────────────────────────────────────
  if (!schwabAccountHash) {
    return (
      <>
        <button
          className="btn-secondary flex items-center gap-1.5 text-xs"
          onClick={handleLinkClick}
          disabled={loading}
        >
          <Link2 className="w-3.5 h-3.5" />
          Link Schwab
        </button>

        {/* Account picker modal */}
        {showPicker && accounts && accounts.length > 1 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Select Schwab Account</h3>
              <div className="space-y-2">
                {accounts.map(a => (
                  <button
                    key={a.hashValue}
                    className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                    onClick={() => {
                      onAccountLinked?.(a.hashValue);
                      setShowPicker(false);
                    }}
                  >
                    <span className="font-mono">...{a.accountNumber?.slice(-4)}</span>
                  </button>
                ))}
              </div>
              <button
                className="mt-3 text-xs text-slate-400 hover:text-slate-600"
                onClick={() => setShowPicker(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Linked ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
        <Link2 className="w-3 h-3" />
        Schwab {accountSuffix || 'Linked'}
        {lastSynced && (
          <span className="text-emerald-500 text-[10px]">
            · {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          className="ml-0.5 hover:text-emerald-900 disabled:opacity-40"
          onClick={handleRefresh}
          disabled={syncing}
          title="Refresh Schwab positions"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
        </button>
        <button
          className="ml-0.5 hover:text-red-600"
          onClick={() => setShowUnlink(true)}
          title="Unlink Schwab account"
        >
          <Unlink className="w-3 h-3" />
        </button>
      </div>

      {error && (
        <span className="text-xs text-red-500 ml-2">{error}</span>
      )}

      <ConfirmModal
        open={showUnlink}
        title="Unlink Schwab Account"
        message="This will remove the Schwab connection. Actual holdings data will no longer be shown. You can re-link at any time."
        confirmLabel="Unlink"
        onConfirm={handleUnlink}
        onCancel={() => setShowUnlink(false)}
      />
    </>
  );
}
