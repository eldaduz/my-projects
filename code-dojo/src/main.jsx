import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './ThemeContext'
import ErrorBoundary from './ErrorBoundary'
import App from './App'
import ModalQaHarness from './ModalQaHarness'
import './styles.css'

const isQaHarness = new URLSearchParams(window.location.search).get('qaHarness') === '1'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      {isQaHarness ? (
        <ErrorBoundary>
          <ModalQaHarness />
        </ErrorBoundary>
      ) : (
        <AuthProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      )}
    </ThemeProvider>
  </React.StrictMode>,
)
