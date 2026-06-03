import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, ApiError } from '../../services/apiService';
import './Login.css';

import logoLeft     from '../../assets/digital-transformation.png';
import logoRight    from '../../assets/stellantis-logo.jpg';
import illustration from '../../assets/loginPage.png';

// ── i18n ──────────────────────────────────────────────────────────────────────
type Lang = 'en' | 'fr';

const labels: Record<Lang, {
  welcome:   string;
  username:  string;
  password:  string;
  login:     string;
  loggingIn: string;
  langBtn:   string;
}> = {
  en: {
    welcome:   'Welcome to R Studio',
    username:  'Username',
    password:  'Password',
    login:     'Login',
    loggingIn: 'Logging in…',
    langBtn:   'FR',
  },
  fr: {
    welcome:   'Bienvenue sur R Studio',
    username:  "Nom d'utilisateur",
    password:  'Mot de passe',
    login:     'Connexion',
    loggingIn: 'Connexion en cours…',
    langBtn:   'EN',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth() as {
    login: (user: unknown, expiresInSeconds?: number) => void;
  };

  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Switch to useState<Lang> and wire up a toggle button to enable language switching
  const lang: Lang = 'en';

  const t = labels[lang];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setUsernameError('');
    setPasswordError('');

    let valid = true;
    if (!username.trim()) {
      setUsernameError('Username is required.');
      valid = false;
    }
    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    }
    if (!valid) return;

    setIsLoading(true);
    try {
      const data = await authApi.login(username, password);
      login(data.user, data.expiresInSeconds ?? 1800);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Invalid username or password.');
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Unable to connect to the server. Please ensure the backend is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-root">

      {/* ── Header ── */}
      <header className="login-header">

        <div className="login-header-logo">
          <img src={logoLeft} alt="Digital Transformation" className="logo-left" />
        </div>

        {/* Language toolbar — uncomment to enable */}
        {/*
        <div className="login-toolbar">
          <button className="toolbar-btn" onClick={toggleLang} title="Switch language">
            <GlobeIcon />
            {t.langBtn}
          </button>
        </div>
        */}

        <div className="login-header-logo">
          <img src={logoRight} alt="Stellantis" className="logo-right" />
        </div>

      </header>

      {/* ── Body ── */}
      <div className="login-body">

        {/* Left – illustration */}
        <div className="login-left">
          <img src={illustration} alt="Login Illustration" className="login-illustration" />
        </div>

        {/* Right – form */}
        <div className="login-right">
          <div className="login-block">

            <div className="login-welcome">{t.welcome}</div>

            {errorMsg && <div className="login-error" role="alert">{errorMsg}</div>}


            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="field-group">
                <label htmlFor="username">{t.username}</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={isLoading}
                  aria-invalid={!!usernameError}
                  aria-describedby="username-error"
                />
                {usernameError && <div className="field-error" id="username-error">{usernameError}</div>}
              </div>

              <div className="field-group">
                <label htmlFor="password">{t.password}</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-invalid={!!passwordError}
                  aria-describedby="password-error"
                />
                {passwordError && <div className="field-error" id="password-error">{passwordError}</div>}
              </div>

              <div className="loginbtn">
                <button className="login-btn" type="submit" disabled={isLoading}>
                  {isLoading ? t.loggingIn : t.login}
                </button>
              </div>
            </form>

            <p className="login-register-hint">
              Don't have an account?{' '}
              <Link to="/register" className="login-register-link">Request Access</Link>
            </p>

          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
