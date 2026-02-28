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

export default defineConfig({
  plugins: [react(), yahooFinanceProxy()],
  build: {
    sourcemap: true,
  },
});
