import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only plugin: proxies /api/yahoo-chart to Yahoo Finance so we don't
// need Vercel running locally.  In production Vercel handles this via
// the serverless function at api/yahoo-chart.js.
function yahooFinanceProxy() {
  return {
    name: 'yahoo-finance-proxy',
    configureServer(server) {
      server.middlewares.use('/api/yahoo-chart', async (req, res) => {
        const params = new URL(req.url ?? '', 'http://localhost').searchParams;
        const ticker = params.get('ticker');
        const from   = params.get('from');
        const to     = params.get('to');

        if (!ticker || !from || !to) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Missing params' }));
        }

        const url =
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
          `?period1=${from}&period2=${to}&interval=1d&includeAdjustedClose=true`;

        try {
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AJAWealth/1.0)' },
          });
          const body = await resp.text();
          res.statusCode = resp.ok ? 200 : resp.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'max-age=300');
          res.end(body);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// Dev-only plugin: proxies /api/schwab-proxy and /api/schwab-auth to the
// Schwab API for local development (mirrors the Vercel serverless functions).
// Requires SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SUPABASE_URL, and
// SUPABASE_SERVICE_ROLE_KEY in .env.  If unconfigured, requests return 501.
function schwabProxy() {
  return {
    name: 'schwab-proxy',
    configureServer(server) {
      // Proxy for positions / accounts / unlink
      server.middlewares.use('/api/schwab-proxy', async (req, res) => {
        try {
          // Dynamically import the serverless handler
          const mod = await server.ssrLoadModule('/api/schwab-proxy.js');
          const params = new URL(req.url ?? '', 'http://localhost').searchParams;
          const query = Object.fromEntries(params.entries());
          const fakeReq = { query, method: req.method };
          const fakeRes = {
            status(code) { res.statusCode = code; return this; },
            json(data) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); },
            setHeader(k, v) { res.setHeader(k, v); return this; },
            redirect(url) { res.writeHead(302, { Location: url }); res.end(); },
            end(body) { res.end(body); },
          };
          await mod.default(fakeReq, fakeRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Proxy for OAuth callback
      server.middlewares.use('/api/schwab-auth', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/schwab-auth.js');
          const params = new URL(req.url ?? '', 'http://localhost').searchParams;
          const query = Object.fromEntries(params.entries());
          const fakeReq = { query, method: req.method };
          const fakeRes = {
            status(code) { res.statusCode = code; return this; },
            json(data) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); },
            setHeader(k, v) { res.setHeader(k, v); return this; },
            redirect(url) { res.writeHead(302, { Location: url }); res.end(); },
            end(body) { res.end(body); },
          };
          await mod.default(fakeReq, fakeRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), yahooFinanceProxy(), schwabProxy()],
  build: {
    sourcemap: true,
  },
});
