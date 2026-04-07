import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Link2, Unlink, AlertTriangle } from 'lucide-react';
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
 *   userId              — current user id
 *   portfolioId         — current portfolio id
 *   schwabAccountHash   — currently linked account hash (from portfolio)
 *   allPortfolios       — all user portfolios (for 1:1 enforcement)
 *   onAccountLinked(accountHash)  — called when user picks an account
 *   onAccountUnlinked()           — called when user unlinks
 *   onPositionsLoaded({ totalValue, positions }) — called when positions arrive
 */
export default function SchwabLinkButton({
  userId,
  portfolioId,
  schwabAccountHash,
  allPortfolios = [],
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

  const configured = isConfigured();

  // Build set of Schwab account hashes already used by OTHER portfolios
  const usedHashes = new Set(
    allPortfolios
      .filter(p => p.id !== portfolioId && p.schwab_account_hash)
      .map(p => p.schwab_account_hash)
  );

  // Handle OAuth error redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schwabError = params.get('schwab_error');
    if (schwabError) {
      const messages = {
        token_exchange_failed: 'Schwab authorization failed — please try again',
        db_error: 'Failed to save Schwab connection — please try again',
        invalid_state: 'Schwab authorization error — invalid session',
        unexpected: 'Unexpected error connecting Schwab — please try again',
      };
      setError(messages[schwabError] || `Schwab error: ${schwabError}`);
      const url = new URL(window.location);
      url.searchParams.delete('schwab_error');
      window.history.replaceState({}, '', url);
    }
  }, []);

  // Check Schwab link status on mount; auto-select after OAuth redirect
  useEffect(() => {
    if (!configured || !userId) return;
    checkSchwabLinked(userId).then(accts => {
      if (!accts || accts.length === 0) return;
      setAccounts(accts);

      // After OAuth redirect, auto-link if no account is selected yet
      const params = new URLSearchParams(window.location.search);
      if (params.get('schwab_linked') === 'true' && !schwabAccountHash) {
        // Clean up the query param
        const url = new URL(window.location);
        url.searchParams.delete('schwab_linked');
        window.history.replaceState({}, '', url);

        const available = accts.filter(a => !usedHashes.has(a.hashValue));
        if (available.length === 1) {
          onAccountLinked?.(available[0].hashValue);
        } else if (available.length > 1) {
          setShowPicker(true);
        }
      }
    }).catch(err => {
      if (err.message === 'reauth_required') {
        setError('Schwab session expired — please re-link your account');
      }
    });
  }, [configured, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!configured) return null;

  // Find linked account info
  const linkedAccount = accounts?.find(a => a.hashValue === schwabAccountHash);
  const accountSuffix = linkedAccount?.accountNumber
    ? `...${linkedAccount.accountNumber.slice(-4)}`
    : null;

  function handleLinkClick() {
    if (accounts && accounts.length > 0) {
      // Filter out accounts already linked to other portfolios
      const available = accounts.filter(a => !usedHashes.has(a.hashValue));
      if (available.length === 0) {
        setError('All Schwab accounts are already linked to other portfolios');
        return;
      }
      if (available.length === 1) {
        onAccountLinked?.(available[0].hashValue);
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
      onAccountUnlinked?.();
      setShowUnlink(false);
      setLastSynced(null);
      setAccounts(null);
    } catch (err) {
      console.error('[Schwab] Unlink failed:', err);
      setError('Failed to unlink Schwab account');
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

        {error && (
          <span className="text-xs text-red-500 ml-2">{error}</span>
        )}

        {/* Account picker modal */}
        {showPicker && accounts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Select Schwab Account</h3>
              <p className="text-xs text-slate-500 mb-3">Each Schwab account can only be linked to one portfolio.</p>
              <div className="space-y-2">
                {accounts.map(a => {
                  const inUse = usedHashes.has(a.hashValue);
                  const linkedTo = inUse
                    ? allPortfolios.find(p => p.schwab_account_hash === a.hashValue)?.name
                    : null;
                  return (
                    <button
                      key={a.hashValue}
                      className={`w-full text-left px-3 py-2 rounded border transition-colors text-sm ${
                        inUse
                          ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                      onClick={() => {
                        if (inUse) return;
                        onAccountLinked?.(a.hashValue);
                        setShowPicker(false);
                      }}
                      disabled={inUse}
                    >
                      <span className="font-mono">...{a.accountNumber?.slice(-4)}</span>
                      {inUse && (
                        <span className="ml-2 text-xs text-slate-400">
                          linked to {linkedTo || 'another portfolio'}
                        </span>
                      )}
                    </button>
                  );
                })}
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
        message="This will disconnect the Schwab account from this portfolio. Target allocations will be preserved. You can re-link at any time."
        confirmLabel="Unlink"
        onConfirm={handleUnlink}
        onCancel={() => setShowUnlink(false)}
      />
    </>
  );
}
