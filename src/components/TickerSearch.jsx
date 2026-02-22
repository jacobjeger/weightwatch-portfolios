import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { INSTRUMENTS } from '../lib/mockData';

export default function TickerSearch({ existingTickers = [], onAdd }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const results = query.trim().length > 0
    ? INSTRUMENTS.filter((i) => {
        const q = query.toUpperCase();
        return (
          i.ticker.startsWith(q) ||
          i.name.toUpperCase().includes(query.toUpperCase())
        );
      }).slice(0, 10)
    : [];

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(instrument) {
    onAdd(instrument);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-8 w-64"
          placeholder="Search ticker or name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1 w-96 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((inst) => {
            const already = existingTickers.includes(inst.ticker);
            return (
              <button
                key={inst.ticker}
                disabled={already}
                onClick={() => handleSelect(inst)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              >
                <div>
                  <span className="font-semibold text-slate-900 text-sm">{inst.ticker}</span>
                  <span className="ml-2 text-xs text-slate-500">{inst.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${inst.type === 'ETF' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {inst.type}
                  </span>
                  {already && <span className="text-xs text-red-500">already added</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-40 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-500">
          No instruments found for "{query}"
        </div>
      )}
    </div>
  );
}
