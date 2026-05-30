import { Component } from 'react';
import { Link } from 'react-router-dom';

/**
 * App-shell error boundary. Wraps the entire Routes tree in App.jsx.
 * Without this, any render error on Saas/Dashboard/Calculator etc. produces
 * a blank white page in front of a paying customer or live prospect.
 *
 * In dev (import.meta.env.DEV), we render the error + stack inline so you can
 * spot it. In prod we render a graceful fallback with a recovery action.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Log to console for browser devtools; downstream telemetry would
    // POST to a /api/client-error endpoint if one existed.
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary] render error:', error);
      if (info?.componentStack) console.error('Component stack:', info.componentStack);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, info: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

    return (
      <main style={{
        paddingTop: '72px',
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 600, padding: '24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 12 }}>
            Something broke.
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            We hit an unexpected error rendering this page. Try reloading. If it
            keeps happening, drop us a note at{' '}
            <a href="mailto:admin@thermashift.net" style={{ color: 'var(--accent)' }}>
              admin@thermashift.net
            </a>
            {' '}with what you were doing.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
            <button onClick={this.handleReload} className="btn btn-primary">
              Reload page
            </button>
            <Link to="/" className="btn">Go home</Link>
          </div>

          {isDev && this.state.error && (
            <pre style={{
              textAlign: 'left',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: 240,
              color: 'var(--danger)',
            }}>
              {String(this.state.error?.stack || this.state.error)}
              {this.state.info?.componentStack ? `\n\nComponent stack:${this.state.info.componentStack}` : ''}
            </pre>
          )}
        </div>
      </main>
    );
  }
}
