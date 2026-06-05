import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import App from './App';
import './index.css';

// Import the Font Awesome core CSS ourselves (above) and stop the library from
// injecting it at runtime — this prevents a flash of oversized icons on first
// paint before the auto-injected styles load.
config.autoAddCss = false;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
