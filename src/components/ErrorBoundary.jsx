import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-xl font-bold">!</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Lightweight boundary for sections — shows inline fallback instead of full-page error */
export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorStack: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const stack = typeof info?.componentStack === 'string' ? info.componentStack : '';
    console.error(`[SectionError] ${this.props.label || 'Unknown'}:`, error?.message, error, stack);
    this.setState({ errorStack: stack });
  }

  render() {
    if (this.state.hasError) {
      const errMsg = typeof this.state.error?.message === 'string'
        ? this.state.error.message
        : String(this.state.error ?? 'Unknown error');
      const stack = typeof this.state.errorStack === 'string' ? this.state.errorStack : '';
      // Grab runtime diagnostic captured by the monkey-patch in ClientPortal.jsx
      const diag = typeof window !== 'undefined' ? window.__reactChildDiag : null;
      return (
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <p className="text-sm text-slate-400 mb-1">
              {String(this.props.label || 'This section')} could not load
            </p>
            <p className="text-xs text-red-400 mb-2 max-w-xs mx-auto break-words">
              {String(errMsg).slice(0, 200)}
            </p>
            {diag && (
              <details open className="text-left max-w-sm mx-auto mb-2 bg-yellow-50 border border-yellow-200 rounded p-2">
                <summary className="text-[10px] text-yellow-700 cursor-pointer font-bold">Object child diagnostic</summary>
                <pre className="text-[9px] text-yellow-800 whitespace-pre-wrap break-all mt-1 max-h-48 overflow-y-auto">
                  {'Component: ' + String(diag.component || '?') + '\n'}
                  {'Child index: ' + String(diag.childIndex) + '\n'}
                  {'Child keys: ' + String(diag.childKeys || []) + '\n'}
                  {'Props keys: ' + String(diag.propsKeys || []) + '\n'}
                  {'Preview: ' + String(diag.childPreview || '').slice(0, 200) + '\n'}
                  {'Time: ' + String(diag.timestamp || '')}
                </pre>
              </details>
            )}
            {stack && (
              <details className="text-left max-w-sm mx-auto mb-2">
                <summary className="text-[10px] text-slate-400 cursor-pointer">Component trace</summary>
                <pre className="text-[9px] text-slate-400 whitespace-pre-wrap break-all mt-1 max-h-32 overflow-y-auto">
                  {String(stack).slice(0, 500)}
                </pre>
              </details>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorStack: '' })}
              className="text-xs text-blue-500 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
