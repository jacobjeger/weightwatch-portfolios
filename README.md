# WeightWatch Portfolios

A portfolio management tool for financial advisors and their clients. Build weighted portfolios, track performance against benchmarks, and collaborate through a client portal with messaging and approval workflows.

## Features

- **Portfolio Builder** — Create portfolios with 130+ US stocks & ETFs, assign weights by role (Core/Tilt/Satellite), set benchmarks, cash reserves, and DRIP preferences
- **Performance Tracking** — Portfolio vs benchmark charts across multiple timeframes (1D to Max), with live data via Finnhub or simulated returns
- **Individual Holdings Charts** — Per-holding return visualization with color-coded lines
- **Benchmarks** — Compare against SPY, QQQ, IWM, DIA, EFA, AGG with multi-line overlay charts
- **Client Portal** — Read-only portfolio view for invited clients with approval/comment workflows
- **Messaging** — Per-portfolio advisor-client communication with real-time polling
- **Share & Invite** — Public share links and authenticated invite tokens for client onboarding
- **History & Snapshots** — Activity log, performance snapshots with CSV export, side-by-side comparison
- **Meeting Scheduler** — Schedule and track client meetings
- **Ticker Summary** — Click any ticker for price, day range, expense ratio, dividend yield, and description

## Tech Stack

- **Frontend:** React 18, React Router 6, Tailwind CSS 3, Recharts, Lucide icons
- **Build:** Vite 5
- **Backend (optional):** Supabase (PostgreSQL + Auth + RLS)
- **Market Data (optional):** Finnhub REST + WebSocket, Yahoo Finance via serverless proxy
- **Deployment:** Vercel-ready with serverless functions

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` in **demo mode** using localStorage and simulated market data — no backend configuration required.

### Optional Environment Variables

Create a `.env` file for real data and persistence:

```env
# Supabase (persistent storage & auth across devices)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Finnhub (real-time quotes & WebSocket trades)
VITE_FINNHUB_API_KEY=your_finnhub_api_key
```

### Supabase Setup

If using Supabase, run the schema in `supabase/schema.sql` against your project to create the required tables and RLS policies.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build to `/dist` |
| `npm run preview` | Preview production build locally |

## Project Structure

```
src/
├── pages/          # Route-level components (Dashboard, PortfolioBuilder, ClientPortal, etc.)
├── components/     # Reusable UI (charts, modals, search, badges)
├── context/        # React Context (Auth, MarketData, Toast)
├── lib/            # Utilities (mockData, finnhub, yahoo, supabase)
supabase/
└── schema.sql      # PostgreSQL schema with RLS policies
api/
└── yahoo-chart.js  # Serverless proxy for Yahoo Finance historical data
```
