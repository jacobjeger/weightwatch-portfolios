import { useState } from 'react';
import { X } from 'lucide-react';
import { BENCHMARKS } from '../lib/mockData';

export default function NewPortfolioModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [benchmark, setBenchmark] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Portfolio name is required.'); return; }
    onCreate({ name: name.trim(), description: description.trim(), primary_benchmark: benchmark || null });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">New Portfolio</h2>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Portfolio Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`input ${error ? 'border-red-400' : ''}`}
              placeholder="e.g. Tech Growth"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Primary Benchmark
            </label>
            <select className="input" value={benchmark} onChange={(e) => setBenchmark(e.target.value)}>
              <option value="">— None —</option>
              {BENCHMARKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create Portfolio</button>
          </div>
        </form>
      </div>
    </div>
  );
}
