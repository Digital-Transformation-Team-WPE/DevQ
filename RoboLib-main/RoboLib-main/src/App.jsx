import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'
import './App.css'
import { msalConfig } from './config/azureConfig'
import { AzureAuthProvider, useAzureAuth } from './context/AzureAuthContext'
import AzureLogin from './components/AzureLogin'
import LoginForm from './components/LoginForm'
import Home from './pages/Home'

// Initialize MSAL
const msalInstance = new PublicClientApplication(msalConfig)

// Handle redirect promise when app loads
msalInstance.handleRedirectPromise().catch(error => {
  console.error('Redirect handling error:', error);
});

// Protected route wrapper - requires Azure authentication (skippable for testing)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAzureAuth()
  const skipAzureAuth = import.meta.env.VITE_SKIP_AZURE_AUTH === 'true'
  
  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }
  
  // If skip flag is enabled or user is authenticated, allow access
  return (skipAzureAuth || isAuthenticated) ? children : <Navigate to="/azure-login" replace />
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Azure authentication page - accessible without login */}
        <Route path="/azure-login" element={<AzureLogin />} />
        
        {/* Protected routes - requires Azure auth */}
        <Route path="/" element={<ProtectedRoute><LoginForm /></ProtectedRoute>} />
        <Route path="/login" element={<ProtectedRoute><LoginForm /></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        
        {/* Catch all - redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AzureAuthProvider>
        <AppContent />
      </AzureAuthProvider>
    </MsalProvider>
  )
}

export default App
