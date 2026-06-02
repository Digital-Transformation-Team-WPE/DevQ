import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAzureAuth } from '../context/AzureAuthContext';
import styles from './AzureLogin.module.css';
import stellantisLogo from '../assets/stellantis-logo.jpg';

const AzureLogin = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, handleLogin, userAccount } = useAzureAuth();
  const skipAzureAuth = import.meta.env.VITE_SKIP_AZURE_AUTH === 'true';
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // User is already authenticated, proceed to login page
      console.log('User authenticated, navigating to /login');
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleAzureSignIn = async () => {
    try {
      setError(null);
      console.log('Starting Azure sign-in (redirect flow)...');
      // loginRedirect will redirect the page, so this returns immediately
      handleLogin();
      // Page will reload after redirect
    } catch (error) {
      console.error('Azure sign-in failed:', error);
      setError(error?.message || 'Sign-in failed. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.logoContainer}>
          <img src={stellantisLogo} alt="Stellantis Logo" className={styles.logo} />
        </div>
        
        <h1 className={styles.title}>Robot Library</h1>
        {/* <p className={styles.subtitle}>Enterprise Access Portal</p> */}

        <div className={styles.content}>
          <p className={styles.description}>
            Sign in with your Microsoft corporate account to continue.
          </p>

          {error && (
            <div style={{ 
              backgroundColor: '#fee', 
              color: '#c33', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '15px',
              border: '1px solid #fcc'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {userAccount && (
            <div className={styles.userInfo}>
              <p className={styles.infoLabel}>Authenticating as:</p>
              <p className={styles.userName}>{userAccount.name}</p>
              <p className={styles.userEmail}>{userAccount.username}</p>
            </div>
          )}

          <button
            onClick={handleAzureSignIn}
            disabled={isLoading}
            className={styles.signInButton}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                Signing In...
              </>
            ) : (
              <>
                <svg className={styles.microsoftIcon} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 0h9v9H0z" fill="#F25022" />
                  <path d="M12 0h9v9h-9z" fill="#7FBA00" />
                  <path d="M0 12h9v9H0z" fill="#00A4EF" />
                  <path d="M12 12h9v9h-9z" fill="#FFB900" />
                </svg>
                Sign In with Microsoft
              </>
            )}
          </button>

          {skipAzureAuth && (
            <button
              onClick={() => navigate('/login')}
              className={styles.skipButton}
            >
              Skip to Internal Login (Testing Only)
            </button>
          )}
        </div>

        <div className={styles.footer}>
          {/* <p className={styles.helpText}>
            Having trouble signing in?{' '}
            <a href="mailto:support@stellantis.com" className={styles.helpLink}>
              Contact IT Support
            </a>
          </p> */}
        </div>
      </div>
    </div>
  );
};

export default AzureLogin;
