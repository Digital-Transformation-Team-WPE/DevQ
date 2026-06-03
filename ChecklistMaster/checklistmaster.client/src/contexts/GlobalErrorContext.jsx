import React, { createContext, useContext, useState, useCallback } from 'react';

const GlobalErrorContext = createContext({
  error: null,
  setError: () => {},
  clearError: () => {},
});

export const useGlobalError = () => useContext(GlobalErrorContext);

export const GlobalErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);
  const clearError = useCallback(() => setError(null), []);
  return (
    <GlobalErrorContext.Provider value={{ error, setError, clearError }}>
      {children}
    </GlobalErrorContext.Provider>
  );
};
