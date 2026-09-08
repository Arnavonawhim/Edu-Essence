import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* dev: mounted under /app alongside the static site. built: its own Vercel project at root. */}
    <BrowserRouter basename={import.meta.env.DEV ? '/app' : '/'}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
