import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { isConfigured, getQuote, subscribeToTrades } from '../lib/finnhub';

// ── Context ───────────────────────────────────────────────────────────────────
const MarketDataContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function MarketDataProvider({ children }) {
  const live = isConfigured();

  // prices: { [ticker]: { price, change, changePercent, prevClose, high, low, open } }
  const [prices, setPrices] = useState({});
  const loadedRef = useRef(new Set()); // tickers already fetched

  // Monotonically increasing counter bumped on every WebSocket trade.
  // Components can depend on this to know "prices changed" without deep-comparing the prices object.
  const [priceVersion, setPriceVersion] = useState(0);

  // Fetch REST quotes for new tickers (deduped, staggered to stay within rate limit)
  const loadTickers = useCallback(async (tickers) => {
    if (!live) return;
    const newOnes = tickers.filter((t) => !loadedRef.current.has(t));
    if (!newOnes.length) return;

    await Promise.all(
      newOnes.map(async (ticker, i) => {
        // ~8 req/s max on free tier — stagger by 120 ms each
        await new Promise((r) => setTimeout(r, i * 120));
        try {
          const q = await getQuote(ticker);
          setPrices((prev) => ({ ...prev, [ticker]: q }));
          loadedRef.current.add(ticker);
        } catch {
          /* silently ignore; caller falls back to mock */
        }
      })
    );
  }, [live]);

  // Subscribe tickers to the WebSocket trade feed.
  // Returns an unsubscribe function to call on cleanup.
  const subscribeTickers = useCallback((tickers) => {
    if (!live) return () => {};

    return subscribeToTrades(tickers, (ticker, price) => {
      setPrices((prev) => {
        const existing = prev[ticker];
        if (!existing) return prev; // not loaded yet — skip
        const prevClose = existing.prevClose ?? existing.price;
        const changePercent =
          prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : existing.changePercent;
        return {
          ...prev,
          [ticker]: { ...existing, price, changePercent },
        };
      });
      setPriceVersion((v) => v + 1);
    });
  }, [live]);

  return (
    <MarketDataContext.Provider value={{ live, prices, priceVersion, loadTickers, subscribeTickers }}>
      {children}
    </MarketDataContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useMarketData() {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useMarketData must be used inside <MarketDataProvider>');
  return ctx;
}
