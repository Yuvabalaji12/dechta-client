import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { CartProvider } from './contexts/CartContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
