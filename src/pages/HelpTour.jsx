import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Search, Scale, TrendingUp, LineChart, Eye, BookOpen,
  ChevronRight, Users, MessageCircle, Share2, PieChart, History, Shield,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Creating a Portfolio',
    content: [
      'Click "New Portfolio" on the Dashboard or in the nav bar.',
      'Name your portfolio, add a description, and choose a primary benchmark (ETF or CBOE index).',
      'Set a Starting Value (e.g. $100,000) and Starting Date for your hypothetical allocation.',
      'Optionally configure a Cash Reserve % and toggle DRIP (Dividend Reinvestment Plan).',
      'Click Save to persist your portfolio. Data syncs across browsers when Supabase is connected.',
    ],
  },
  {
    icon: <Search className="w-5 h-5" />,
    title: 'Adding Holdings & Ticker Search',
    content: [
      'Use the search bar in the Portfolio Builder to find US-listed stocks and ETFs.',
      'When Finnhub is configured, search returns real-time results from all US exchanges.',
      'Without Finnhub, search pulls from our built-in database of 130+ instruments.',
      'Duplicate tickers are prevented — already-added tickers show as disabled.',
      'Each holding gets a live price (green dot = Finnhub real-time), a slider for target weight, and a Core / Tilt / Satellite role tag.',
    ],
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: 'Weights, Sliders & Categories',
    content: [
      'Use the slider or type a number to set each holding\'s target weight (0–100%).',
      'The total must sum to 100% for the portfolio to be "Fully Allocated" (green badge).',
      'If weights don\'t add up, click "Normalize to 100%" to scale them proportionally.',
      'Assign each holding a role using the colored pill buttons: Core (blue), Tilt (violet), or Satellite (amber).',
      'The Allocation Breakdown section shows a bar chart grouped by Core / Tilt / Satellite totals.',
    ],
  },
  {
    icon: <PieChart className="w-5 h-5" />,
    title: 'Allocation Wheel & History',
    content: [
      'The Allocation Wheel is a pie chart showing each holding\'s weight visually.',
      'When you have weight history (from saving changes over time), use the ← Prev / Next → buttons to browse past allocation snapshots.',
      'Each snapshot shows its date and event type (Created, Adjusted, Rebalanced, etc.).',
      'The Current view always shows today\'s live allocation.',
    ],
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Performance & Real Market Data',
    content: [
      'Performance Summary shows returns across 1D, 7D, 1M, 3M, 6M, and 1Y periods.',
      'When Finnhub API is configured, returns are calculated from real daily closing prices — labeled "Real" with a green background.',
      'Without Finnhub, returns are simulated using a realistic random walk model — labeled "Simulated".',
      'Portfolio return = weighted sum of each holding\'s individual return over the period.',
      'Alpha = Portfolio return − Benchmark return. Positive alpha (▲ green) means outperformance.',
      'The Performance Chart plots your portfolio vs. benchmark over time with selectable ranges.',
    ],
  },
  {
    icon: <LineChart className="w-5 h-5" />,
    title: 'Live Snapshot & Expense Breakdown',
    content: [
      'The Live Snapshot panel shows your top 5 holdings with real-time prices and daily % change.',
      'Portfolio today shows your weighted 1-day return, and the benchmark\'s 1D return alongside.',
      'Estimated Value is your starting value adjusted for cumulative growth/decline.',
      'Wtd. Expense Ratio: click to expand and see every holding\'s ER and weighted contribution.',
      'Wtd. Div. Yield: same breakdown for dividend yield — useful for income-focused portfolios.',
      'Holdings not in our database show "N/A" for ER and yield data.',
    ],
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Benchmarks',
    content: [
      'Choose from ETF benchmarks (SPY, QQQ, IWM, DIA) or CBOE index versions (SPX, NDX, RUT, DJI).',
      'Additional benchmarks: EFA (international developed markets) and AGG (US aggregate bonds).',
      'Set an account-level default benchmark on the Benchmarks page or in Settings.',
      'Each portfolio can override the default with its own benchmark.',
      'Benchmark current price and previous close are displayed in the Live Snapshot when Finnhub is active.',
    ],
  },
  {
    icon: <History className="w-5 h-5" />,
    title: 'Weight History & Rebalancing',
    content: [
      'Every time you save, AJA logs what changed: weights adjusted, holdings added/removed.',
      'The Weight History panel shows a timeline of all changes with before/after values.',
      'Current % in the holdings table shows drift — how each holding\'s weight has shifted due to price movements.',
      'When drift exceeds 0.5%, a Rebalance button appears to reset all holdings to their target weights.',
      'Rebalancing updates entry prices to current market prices and logs a "Rebalanced" event.',
    ],
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Advisor & Client Roles',
    content: [
      'The app supports two roles: Advisor (full access to create/edit portfolios) and Client (read-only view).',
      'Advisors can invite clients via the "Invite Client" button — this generates a unique invite URL.',
      'When a client opens the invite link, they can sign up or log in to accept the invitation.',
      'Accepted clients see the advisor\'s portfolio as read-only on their Dashboard.',
      'The invite link works across browsers — invite data is encoded in the URL for demo mode.',
    ],
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'Messaging & Approval Workflow',
    content: [
      'The Messages panel (collapsible) enables advisor ↔ client communication per portfolio.',
      'Both advisor and client can send text comments that appear as chat bubbles.',
      'Clients see Approve and Request Changes buttons to formally respond to the portfolio.',
      'Approval/change-request messages appear as colored status banners (green for approved, amber for changes requested).',
      'The advisor\'s sidebar shows the latest approval status with a colored badge.',
    ],
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: 'Sharing & Client Portals',
    content: [
      'Share Link: generates a read-only public snapshot URL that anyone can view (no login required).',
      'Invite Client: generates a personalized invite URL — the client sees a branded portal with holdings, charts, and messaging.',
      'The Client Portal shows: portfolio details, holdings table with roles, allocation wheel, performance chart, and messaging.',
      'Clients can approve or request changes directly from their portal.',
    ],
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Data & Cross-Browser Sync',
    content: [
      'Demo mode: all data stored in localStorage — works instantly with no setup.',
      'Supabase mode: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env for real cloud sync.',
      'With Supabase connected, portfolios sync across browsers automatically on login.',
      'Finnhub API: set VITE_FINNHUB_API_KEY for real-time prices, search, and performance data.',
      'Without Finnhub, the app uses realistic simulated market data from our built-in model.',
    ],
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: 'All Pages Overview',
    content: [
      'Dashboard: summary table of all portfolios with status badges, performance, and bulk actions.',
      'Portfolio Builder: full editing environment with holdings, charts, allocation wheel, weight history, and messaging.',
      'Benchmarks: performance comparison for all supported benchmarks with a normalized chart.',
      'History: three tabs — Activity Log (all actions), Performance Snapshots (returns per portfolio), and Compare Snapshots.',
      'Settings: customize default benchmark, visible timeframes, chart range, snapshot refresh rate, and more.',
      'Help & Tour: this page — documentation for every feature in the app.',
    ],
  },
];

export default function HelpTour() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" />
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Help &amp; Tour</h1>
      </div>
      <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-8">
        Everything you need to know about AJA Wealth Management.
      </p>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
        <button className="btn-primary" onClick={() => navigate('/portfolio/new')}>
          <BarChart3 className="w-4 h-4" />
          New Portfolio
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Dashboard
          <ChevronRight className="w-4 h-4" />
        </button>
        <button className="btn-secondary" onClick={() => navigate('/benchmarks')}>
          Benchmarks
          <ChevronRight className="w-4 h-4" />
        </button>
        <button className="btn-secondary" onClick={() => navigate('/settings')}>
          Settings
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-4 sm:space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                {section.icon}
              </div>
              <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            </div>
            <ul className="space-y-2">
              {section.content.map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="text-blue-400 font-bold mt-0.5">·</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>About data sources:</strong> When a Finnhub API key is configured, AJA uses real market data
        for prices, charts, and performance returns. Without it, the app runs in simulation mode with realistic
        modeled data. No real trades are ever placed — this is a portfolio planning and visualization tool.
      </div>
    </div>
  );
}
