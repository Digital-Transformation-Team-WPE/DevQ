import Dashboard from './Components/Dashboard/Dashboard';
import NotFoundPage from './Components/NotFoundPage.jsx';
import ProtectedRoute from './Components/ProtectedRoute';

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ServerDownPage from './Components/ServerDownPage.jsx';
import { GlobalErrorProvider } from './contexts/GlobalErrorContext.jsx';
import { AuthProvider } from './contexts/AuthContext';
import Login from './Components/LandingPage/Login';
import Register from './Components/LandingPage/Register';

function App() {
  const [serverDown, setServerDown] = useState(false);
  useEffect(() => {
    const handler = () => setServerDown(true);
    window.addEventListener('cm:server-down', handler);
    return () => window.removeEventListener('cm:server-down', handler);
  }, []);

  if (serverDown) {
    return <ServerDownPage />;
  }

  return (
    <GlobalErrorProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/"            element={<Login />} />
            <Route path="/register"    element={<Register />} />
            <Route path="/dashboard/*" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </GlobalErrorProvider>
  );
}

export default App;