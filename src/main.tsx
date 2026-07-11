import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept global fetch to automatically prepend window.location.origin to all relative "/api/" requests.
// This resolves Safari same-origin iframe sandbox blocks ("Load failed") by ensuring all requests are fully-qualified same-origin requests.
if (typeof window !== "undefined") {
  try {
    const originalFetch = window.fetch;
    if (originalFetch) {
      const customFetch = async function (input: RequestInfo | URL, init?: RequestInit) {
        let finalInput = input;
        if (typeof input === "string" && (input.startsWith("/api/") || input.startsWith("api/"))) {
          const cleanPath = input.startsWith("/") ? input : `/${input}`;
          finalInput = `${window.location.origin}${cleanPath}`;
        } else if (input instanceof URL && input.pathname.startsWith("/api/")) {
          finalInput = new URL(input.pathname + input.search, window.location.origin);
        }
        return originalFetch(finalInput, init);
      };

      try {
        Object.defineProperty(window, 'fetch', {
          value: customFetch,
          configurable: true,
          writable: true,
          enumerable: true
        });
      } catch (defineError) {
        // Fallback to simple assignment if defineProperty fails or descriptor is not configurable
        (window as any).fetch = customFetch;
      }
    }
  } catch (err) {
    console.warn("Could not intercept global fetch safely (readonly property or sandboxed environment):", err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
