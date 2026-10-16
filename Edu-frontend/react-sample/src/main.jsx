import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

/* This app is its own Vercel project, so it cannot read the marketing site's
   localStorage. That site hands the session over in a ?token= query param —
   consume it before React mounts, then strip it back out of the URL so the
   token isn't left sitting in the address bar or in browser history. */
(function consumeTokenHandoff() {
  const params = new URLSearchParams(window.location.search);
  const handoff = params.get('token');
  if (!handoff) return;

  localStorage.setItem('access_token', handoff);
  localStorage.setItem('isLoggedIn', 'true');

  params.delete('token');
  const query = params.toString();
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + (query ? `?${query}` : '')
  );
})();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* dev: mounted under /app alongside the static site. built: its own Vercel project at root. */}
    <BrowserRouter basename={import.meta.env.DEV ? '/app' : '/'}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
