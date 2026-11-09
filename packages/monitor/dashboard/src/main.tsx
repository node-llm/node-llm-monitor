import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config'; // Add i18n initialization
import { configureI18n } from './i18n/config';
import { applyUiConfig } from './ui-config';

// Apply server-side injected configuration if available
if ((window as any).__MONITOR_I18N__) {
  configureI18n((window as any).__MONITOR_I18N__);
}

applyUiConfig();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
