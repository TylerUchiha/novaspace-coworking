import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './components/AuthProvider';
import { RemoteConfigProvider } from './components/RemoteConfigProvider';
import { MonitoringErrorBoundary } from './components/MonitoringErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <MonitoringErrorBoundary>
      <RemoteConfigProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </RemoteConfigProvider>
    </MonitoringErrorBoundary>
  </React.StrictMode>
);
