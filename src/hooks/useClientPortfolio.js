import { useState, useEffect, useMemo, useCallback } from 'react';
import { getPortfolios, getMessages, getLatestApproval } from '../context/AuthContext';
import { BENCHMARK_META, getPortfolioReturn, getPortfolioYTDReturn, getReturn, getYTDReturn, getPortfolioSinceReturn } from '../lib/mockData';
import { getRealPerformanceReturns } from '../lib/finnhub';
import { useMarketData } from '../context/MarketDataContext';

export function useClientPortfolio(user, role, refreshClientPortfolios) {
  const [portfolios, setPortfolios] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { live, prices, loadTickers, subscribeTickers } = useMarketData();
  const [realReturns, setRealReturns] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Load portfolios (already sanitized at the AuthContext boundary)
  const loadPortfolios = useCallback(() => {
    if (!user) return;
    try {
      const all = getPortfolios(user.id);
      // Only show portfolios shared with this client (not owned by them)
      const clientPortfolios = all.filter((p) => p.owner !== user.id);
      setPortfolios(clientPortfolios.length > 0 ? clientPortfolios : all);
    } catch (e) {
      console.error('[ClientPortal] loadPortfolios failed:', e);
      setPortfolios([]);
    }
  }, [user]);

  useEffect(() => { loadPortfolios(); }, [loadPortfolios]);

  // Calculate unread message counts for each portfolio
  useEffect(() => {
    if (!user || !portfolios.length) return;
    const counts = {};
    portfolios.forEach((p) => {
      const msgs = getMessages(p.id);
      counts[p.id] = msgs.filter((m) => m.sender_id !== user.id && m.sender_role === 'advisor').length;
    });
    setUnreadCounts(counts);
  }, [user, portfolios]);

  // Sync portfolios from advisor
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await refreshClientPortfolios();
      loadPortfolios();
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  }, [refreshClientPortfolios, loadPortfolios]);

  // Auto-sync every 10 seconds
  useEffect(() => {
    if (!user || role !== 'client') return;
    handleSync(); // initial sync
    const interval = setInterval(handleSync, 10000);
    return () => clearInterval(interval);
  }, [user, role, handleSync]);

  const portfolio = portfolios[selectedIdx] || null;
  const approval = portfolio ? getLatestApproval(portfolio.id) : null;
  const holdings = portfolio?.holdings ?? [];
  const benchmark = portfolio?.primary_benchmark ?? null;

  // Load + subscribe real-time prices
  useEffect(() => {
    if (!live || !portfolio) return;
    const tickers = holdings.map((h) => h.ticker);
    if (benchmark) tickers.push(benchmark);
    if (!tickers.length) return;
    loadTickers(tickers);
    const unsub = subscribeTickers(tickers);
    return unsub;
  }, [live, holdings, benchmark, loadTickers, subscribeTickers, portfolio]);

  // Fetch real candle-based returns
  useEffect(() => {
    if (!live || !holdings.length) return;
    let cancelled = false;
    getRealPerformanceReturns(holdings, benchmark || null).then((data) => {
      if (!cancelled && data) setRealReturns(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [live, holdings, benchmark]);

  const benchLabel = benchmark ? (BENCHMARK_META[benchmark]?.label ?? benchmark) : null;

  // Drifted weights using live prices
  const currentWeights = useMemo(() => {
    if (!holdings.length) return {};
    try {
      const rows = holdings.map((h) => {
        const currentPrice = (live && prices[h.ticker]?.price) || h.last_price;
        const entryPrice = h.entry_price ?? h.last_price;
        const ratio = (entryPrice && entryPrice > 0) ? currentPrice / entryPrice : 1;
        return { ticker: h.ticker, targetWeight: h.weight_percent, ratio };
      });
      const denom = rows.reduce((s, r) => s + (r.targetWeight / 100) * r.ratio, 0);
      if (!denom) return {};
      return Object.fromEntries(rows.map((r) => [r.ticker, {
        driftedWeight: parseFloat(((r.targetWeight / 100) * r.ratio / denom * 100).toFixed(2)),
        ratio: r.ratio,
      }]));
    } catch {
      return {};
    }
  }, [holdings, prices, live]);

  // Performance metrics
  const ytdReturn = useMemo(() => {
    try {
      const val = realReturns?.portfolio?.['YTD'] ?? (holdings.length ? parseFloat(getPortfolioYTDReturn(holdings)) : null);
      return typeof val === 'number' && !isNaN(val) ? val : null;
    } catch { return null; }
  }, [realReturns, holdings]);

  const sinceReturn = useMemo(() => {
    try {
      if (live && holdings.length && Object.keys(currentWeights).length) {
        const growthFactor = holdings.reduce(
          (s, h) => s + (h.weight_percent / 100) * (currentWeights[h.ticker]?.ratio ?? 1), 0
        );
        const val = parseFloat(((growthFactor - 1) * 100).toFixed(2));
        return isNaN(val) ? null : val;
      }
      if (portfolio?.created_at && holdings.length) {
        const val = parseFloat(getPortfolioSinceReturn(holdings, portfolio.created_at));
        return isNaN(val) ? null : val;
      }
      return null;
    } catch { return null; }
  }, [live, holdings, currentWeights, portfolio]);

  const oneYearReturn = useMemo(() => {
    try {
      const val = realReturns?.portfolio?.['1Y'] ?? (holdings.length ? parseFloat(getPortfolioReturn(holdings, 252)) : null);
      return typeof val === 'number' && !isNaN(val) ? val : null;
    } catch { return null; }
  }, [realReturns, holdings]);

  const benchYtd = useMemo(() => {
    try {
      const val = realReturns?.benchmark?.['YTD'] ?? (benchmark ? parseFloat(getYTDReturn(benchmark)) : null);
      return typeof val === 'number' && !isNaN(val) ? val : null;
    } catch { return null; }
  }, [realReturns, benchmark]);

  const cashPercent = portfolio?.cash_percent ?? 0;

  const currentPortfolioValue = useMemo(() => {
    try {
      const sv = portfolio?.starting_value ?? 0;
      if (!holdings.length || !sv) return sv;
      const investedFrac = 1 - cashPercent / 100;
      const growthFactor = holdings.reduce(
        (s, h) => s + (h.weight_percent / 100) * (currentWeights[h.ticker]?.ratio ?? 1), 0
      );
      return sv * (growthFactor * investedFrac + cashPercent / 100);
    } catch {
      return 0;
    }
  }, [holdings, currentWeights, portfolio, cashPercent]);

  const totalWeight = holdings.reduce((s, h) => s + h.weight_percent, 0);

  return {
    portfolios, portfolio, selectedIdx, setSelectedIdx,
    holdings, approval, benchmark, benchLabel,
    syncing, lastSync, unreadCounts, realReturns, setRealReturns,
    currentWeights, ytdReturn, sinceReturn, oneYearReturn, benchYtd,
    currentPortfolioValue, totalWeight, cashPercent,
    live, prices, handleSync,
  };
}
