// Suppress harmless Chrome extension errors ("Could not establish connection")
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message?.includes('Could not establish connection')) {
    e.preventDefault();
  }
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
