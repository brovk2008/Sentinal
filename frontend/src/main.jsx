import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'
import './i18n/index.js'
import { initPageTranslator } from './utils/dynamicTranslator.js'

// Initialize DOM-level full-page translator
// Listens for 'sentinal-language-changed' event dispatched by Topbar
initPageTranslator()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
