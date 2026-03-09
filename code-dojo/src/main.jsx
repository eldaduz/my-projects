import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './ThemeContext'
import ErrorBoundary from './ErrorBoundary'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
