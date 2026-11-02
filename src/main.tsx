import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface RootErrorBoundaryState {
  error: string | null;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { error: error instanceof Error ? error.stack || error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('O app encontrou um erro ao renderizar:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: 24, background: '#071326', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>O Cartões encontrou um erro</h1>
          <p style={{ marginTop: 8, color: '#cbd5e1' }}>Copie esta mensagem para identificar e corrigir a falha:</p>
          <pre style={{ marginTop: 16, padding: 16, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fda4af', fontSize: 12 }}>{this.state.error}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: '#1e293b', color: '#f8fafc', cursor: 'pointer' }}>Recarregar aplicativo</button>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
