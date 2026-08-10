import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/Errors/ErrorBoundary'
import './index.css'

// The boundary sits outside App, not inside it: a crash in App's own body —
// the auth gate, the tab shell — has to be caught by something that isn't App.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
