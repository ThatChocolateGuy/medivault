import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'

// Initialize mobile console for debugging on phones
if (import.meta.env.DEV) {
  import('eruda').then((eruda) => eruda.default.init());

  // Prevent Vite from auto-reloading when WebSocket disconnects
  // This happens when camera app backgrounds the browser
  if (import.meta.hot) {
    import.meta.hot.on('vite:ws:disconnect', () => {
      console.log('⚠️ Vite WebSocket disconnected (camera backgrounded app)');
      console.log('🔄 Will reconnect automatically when app returns to foreground');
    });

    import.meta.hot.on('vite:ws:connect', () => {
      console.log('✅ Vite WebSocket reconnected');
    });
  }

  // Log visibility changes to track when camera opens
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('📱 App backgrounded (camera opened)');
    } else {
      console.log('📱 App foregrounded (camera closed)');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
