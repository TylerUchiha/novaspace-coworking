import React from 'react';
import { useLocation } from 'react-router-dom';
import { reportError } from '../services/firebaseMonitoring';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class MonitoringErrorBoundary extends React.Component<Props, State> {
  declare readonly props: Readonly<Props>;
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack ?? '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
            <p className="text-slate-500 font-medium">
              An unexpected error occurred. Please refresh the page or contact support@novaspace.work.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function RouteAwareErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <MonitoringErrorBoundary key={location.pathname}>{children}</MonitoringErrorBoundary>;
}
