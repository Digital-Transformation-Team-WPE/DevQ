import React, { createContext, useContext, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';

const AzureAuthContext = createContext();

export const useAzureAuth = () => {
  const context = useContext(AzureAuthContext);
  if (!context) {
    throw new Error('useAzureAuth must be used within AzureAuthProvider');
  }
  return context;
};

export const AzureAuthProvider = ({ children }) => {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = accounts.length > 0;
  const userAccount = accounts.length > 0 ? accounts[0] : null;

  useEffect(() => {
    console.log('Auth state changed:', { 
      isAuthenticated, 
      accountsCount: accounts.length,
      inProgress,
      userAccount: userAccount?.name 
    });
  }, [isAuthenticated, accounts, inProgress, userAccount]);

  const handleLogin = async () => {
    try {
      console.log('Initiating loginRedirect...');
      // Use redirect instead of popup to avoid COOP policy issues
      await instance.loginRedirect({
        scopes: ['User.Read'],
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    instance.logout();
  };

  const value = {
    isAuthenticated,
    isLoading: inProgress === 'login' || inProgress === 'logout',
    userAccount,
    handleLogin,
    handleLogout,
    instance,
  };

  return (
    <AzureAuthContext.Provider value={value}>
      {children}
    </AzureAuthContext.Provider>
  );
};
