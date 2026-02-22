import { useNavigate } from 'react-router-dom';
import { BarChart3, Search, Scale, TrendingUp, LineChart, Eye, BookOpen, ChevronRight } from 'lucide-react';

const SECTIONS = [
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Creating a Portfolio',
    content: [
      'Click "New Portfolio" on the Dashboard or in the nav.',
      'Give your portfolio a name, optional description, and choose a primary benchmark (e.g. SPY).',
      'You will land in the Portfolio Builder where you can add holdings.',
      'Portfolios are saved automatically when you click Save.',
    ],
  },
  {
    icon: <Search className="w-5 h-5" />,
    title: 'Ticker Search & Duplicate Prevention',
    content: [
      'Use the search box in the Portfolio Builder to find US-listed stocks and ETFs by ticker symbol or company name.',
      'Start typing (e.g. "AAPL" or "Apple") and matching results appear immediately.',
      'If a ticker is already in your portfolio, it will be shown as "already added" and cannot be selected again — preventing accidental duplicates.',
      'Tickers are matched from our instrument database of 50+ common US stocks and ETFs.',
    ],
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: 'Weight Validation & Normalize Tool',
    content: [
      'Every holding has a Weight % field. Weights must sum to exactly 100% for a portfolio to be "Fully Allocated".',
      'A running total is shown at the bottom of the holdings table. It turns red if the total is far from 100%, yellow if close, green if correct.',
      'If weights don\'t sum to 100%, a warning banner appears with a Normalize button.',
      '"Normalize to 100%" proportionally scales all weights so they sum to exactly 100%. For example, if your weights sum to 80%, each will be scaled up proportionally.',
      'You can also type weights freely and normalize at the end.',
    ],
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Account vs. Portfolio Benchmarks',
    content: [
      'Account Defaults: You can set a default benchmark in Account Settings or on the Benchmarks page. This applies to all new portfolios.',
      'Portfolio Benchmark: Each portfolio can have its own primary benchmark, overriding the account default.',
      '"Inherit Defaults" toggle (in Settings/Benchmarks) controls whether new portfolios automatically pick up your account-level benchmark.',
      'Supported benchmarks: SPY (S&P 500), QQQ (Nasdaq-100), IWM (Russell 2000), EFA (MSCI EAFE), ACWI (MSCI All-World), AGG (US Aggregate Bond).',
      'Select "None" to disable benchmark comparison for a portfolio.',
    ],
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Performance Timeframes & Return Calculation',
    content: [
      'Performance is shown across 1D, 7D, 1M, 3M, 6M, and 1Y periods.',
      'Returns are calculated as the buy-and-hold weighted return: each holding\'s return is multiplied by its weight and summed.',
      'All performance data is hypothetical and simulated — no real brokerage or market data is used.',
      'Portfolio return = Σ (weight_i × return_i) for each holding over the selected period.',
      'Alpha = Portfolio return − Benchmark return for the same period.',
      'You can hide timeframes you don\'t care about in Account Settings.',
    ],
  },
  {
    icon: <LineChart className="w-5 h-5" />,
    title: 'Reading Charts & the Snapshot Panel',
    content: [
      'The Performance Chart shows normalized returns: both portfolio and benchmark start at 100 on day 0.',
      'A value of 110 means +10% return since the start of the period. A dashed reference line marks 100 (breakeven).',
      'Use the range buttons (1M / 3M / 6M / 1Y / Max) to change the chart period.',
      'The Live Snapshot panel (right sidebar in Portfolio Builder) shows your top 5 holdings by weight with simulated daily price moves.',
      'Positive moves are shown in green, negative in red.',
    ],
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: 'Overview of All Pages',
    content: [
      'Dashboard: Summary table of all your portfolios with status, performance, and last-updated info. Use the checkbox column for bulk delete.',
      'Portfolio Builder: Full editing environment — holdings table, ticker search, weight validation, performance chart, and live snapshot.',
      'Benchmarks: Performance table for all 6 supported benchmarks, plus a normalized comparison chart. Set your account-level benchmark defaults here.',
      'History: Three tabs — Activity Log (all create/update/duplicate/delete actions), Performance Snapshots (returns for each portfolio × timeframe), and Compare Snapshots (side-by-side comparison of two timeframes for one portfolio).',
      'Account Settings: Customize benchmark defaults, visible timeframes, chart range, snapshot refresh rate, delete confirmation behavior, and activity log granularity.',
    ],
  },
];

export default function HelpTour() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Help &amp; Tour</h1>
      </div>
      <p className="text-slate-500 mb-8">
        Everything you need to know about WeightWatch Portfolios. All performance is hypothetical — no real trades are placed.
      </p>

      {/* Quick action buttons */}
      <div className="flex gap-3 mb-8">
        <button
          className="btn-primary"
          onClick={() => navigate('/portfolio/new')}
        >
          <BarChart3 className="w-4 h-4" />
          Open Portfolio Builder
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate('/')}
        >
          Go to Dashboard
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
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
      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>Disclaimer:</strong> WeightWatch Portfolios is a hypothetical portfolio simulator. All price data, returns, and
        performance figures are simulated for educational and experimental purposes only. No real trades are placed,
        and nothing in this application constitutes financial advice.
      </div>
    </div>
  );
}
