import { Component } from 'react';
import { logReactError } from '../lib/errorLogger';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    logReactError(error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <h2 className="text-lg font-semibold text-slate-700">Something went wrong</h2>
        <p className="text-sm text-slate-500 text-center max-w-md">
          An unexpected error occurred. The error has been automatically reported.
        </p>
        <details className="text-xs text-slate-400 max-w-md">
          <summary className="cursor-pointer hover:text-slate-600">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error?.message}</pre>
        </details>
        <button
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
