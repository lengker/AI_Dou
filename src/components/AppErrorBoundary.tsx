import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crashed', error, errorInfo);
    // #region debug-point D:component-did-catch
    fetch('http://10.139.186.240:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'upload-webview-bug',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'src/components/AppErrorBoundary.tsx:31',
        msg: '[DEBUG] react error boundary triggered',
        data: {
          errorName: error.name,
          errorMessage: error.message,
          componentStack: errorInfo.componentStack,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  handleWindowError = (event: ErrorEvent) => {
    console.error('Unhandled window error', event.error ?? event.message);
    // #region debug-point D:window-error
    fetch('http://10.139.186.240:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'upload-webview-bug',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'src/components/AppErrorBoundary.tsx:48',
        msg: '[DEBUG] window error event',
        data: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          errorMessage: event.error?.message ?? null,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    this.setState({ hasError: true });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection', event.reason);
    // #region debug-point D:unhandled-rejection
    fetch('http://10.139.186.240:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'upload-webview-bug',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'src/components/AppErrorBoundary.tsx:67',
        msg: '[DEBUG] unhandled rejection event',
        data: {
          reason: typeof event.reason === 'object' && event.reason !== null
            ? JSON.stringify(event.reason, Object.getOwnPropertyNames(event.reason))
            : String(event.reason),
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    this.setState({ hasError: true });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#ffffff',
            color: '#111111',
            textAlign: 'center',
            zIndex: 9999,
          }}
        >
          <div style={{ maxWidth: '420px', lineHeight: 1.7 }}>
            <h1 style={{ fontSize: '20px', marginBottom: '12px' }}>哎呀，房间刚刚掉线了</h1>
            <p>作品已触发错误兜底。请重新打开页面或返回作品入口后再试一次。</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
