import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'

// Initialize mobile console for debugging on phones
if (import.meta.env.DEV) {
  import('eruda').then((eruda) => eruda.default.init());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
