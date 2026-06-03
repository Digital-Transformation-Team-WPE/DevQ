import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authApi, ApiError } from '../../services/apiService';
import './Login.css';
import './Register.css';

import logoLeft  from '../../assets/digital-transformation.png';
import logoRight from '../../assets/stellantis-logo.jpg';

const ROLE_OPTIONS = [
  { value: 'Viewer',    label: 'Viewer' },
  { value: 'AVP_User',  label: 'AVP User' },
  { value: 'WGDE_User', label: 'WGDE User' },
];

type Status = 'idle' | 'loading' | 'success' | 'error';
type EmailValState = 'idle' | 'checking' | 'valid' | 'invalid';

const Register: React.FC = () => {
  const [userId,       setUserId]       = useState('');
  const [userName,     setUserName]     = useState('');
  const [emailId,      setEmailId]      = useState('');
  const [role,         setRole]         = useState('Viewer');
  const [status,       setStatus]       = useState<Status>('idle');
  const [message,      setMessage]      = useState('');
  const [emailValState, setEmailValState] = useState<EmailValState>('idle');
  const [emailValMsg,   setEmailValMsg]   = useState('');

  const validateEmailOnBlur = useCallback(async () => {
    const trimmed = emailId.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    setEmailValState('checking');
    setEmailValMsg('');
    try {
      const res = await authApi.validateEmail(trimmed);
      if (res.valid) {
        setEmailValState('valid');
        setEmailValMsg('');
      } else {
        setEmailValState('invalid');
        setEmailValMsg(res.message ?? 'Email not recognised.');
      }
    } catch {
      setEmailValState('idle');
    }
  }, [emailId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (emailValState === 'invalid') return;
    setStatus('loading');
    setMessage('');
    try {
      await authApi.register({ userId, userName, emailId, role });
      setStatus('success');
      setMessage('Your registration request has been submitted. An administrator will review and approve your account. You will then be able to log in with the default password once approved.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Unable to connect to the server.');
    }
  };

  const isLoading = status === 'loading';

  return (
    <div className="login-page-root">

      {/* Header */}
      <header className="login-header">
        <div className="login-header-logo">
          <img src={logoLeft} alt="Digital Transformation" className="logo-left" />
        </div>
        <div className="login-header-logo">
          <img src={logoRight} alt="Stellantis" className="logo-right" />
        </div>
      </header>

      {/* Body */}
      <div className="login-body">

        {/* Left — branding panel */}
        <div className="login-left reg-left-panel">
          <div className="reg-brand-content">
            <div className="reg-brand-icon">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="20" r="12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                <path d="M8 56c0-13.255 10.745-24 24-24s24 10.745 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="50" cy="50" r="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M46 50l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="reg-brand-title">Request Access</h2>
            <p className="reg-brand-desc">
              Fill in your details to request an account. A system administrator
              will review your request and activate your access.
            </p>
            <ul className="reg-steps">
              <li><span className="reg-step-dot">1</span>Submit your registration details</li>
              <li><span className="reg-step-dot">2</span>Admin reviews and approves</li>
              <li><span className="reg-step-dot">3</span>Log in with the default password</li>
            </ul>
          </div>
        </div>

        {/* Right — form */}
        <div className="login-right">
          <div className="login-block reg-block">

            <div className="login-welcome">Create Account</div>

            {status === 'error' && (
              <div className="login-error" role="alert">{message}</div>
            )}

            {status === 'success' ? (
              <div className="reg-success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <p>{message}</p>
                <Link to="/" className="reg-back-link">Back to Login</Link>
              </div>
            ) : (
              <>
                <form className="login-form" onSubmit={handleSubmit}>

                  <div className="field-group">
                    <label htmlFor="reg-name">Full Name <span className="req">*</span></label>
                    <input
                      id="reg-name"
                      type="text"
                      value={userName}
                      onChange={e => setUserName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="reg-userid">Username <span className="req">*</span></label>
                    <input
                      id="reg-userid"
                      type="text"
                      value={userId}
                      onChange={e => setUserId(e.target.value)}
                      placeholder="e.g. john.doe"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="reg-email">Email <span className="req">*</span></label>
                    <input
                      id="reg-email"
                      type="email"
                      value={emailId}
                      onChange={e => { setEmailId(e.target.value); setEmailValState('idle'); setEmailValMsg(''); }}
                      onBlur={validateEmailOnBlur}
                      placeholder="email@company.com"
                      required
                      disabled={isLoading}
                      style={emailValState === 'invalid' ? { borderColor: '#e74c3c' } : emailValState === 'valid' ? { borderColor: '#27ae60' } : undefined}
                    />
                    {emailValState === 'checking' && (
                      <span className="reg-field-hint reg-hint-checking">Checking organisation directory…</span>
                    )}
                    {emailValState === 'valid' && (
                      <span className="reg-field-hint reg-hint-valid">Email recognised as an organisation address.</span>
                    )}
                    {emailValState === 'invalid' && (
                      <span className="reg-field-hint reg-hint-invalid">{emailValMsg}</span>
                    )}
                  </div>

                  <div className="field-group">
                    <label htmlFor="reg-role">Requested Role</label>
                    <select
                      id="reg-role"
                      className="reg-select"
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      disabled={isLoading}
                    >
                      {ROLE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="loginbtn">
                    <button
                      className="login-btn"
                      type="submit"
                      disabled={isLoading || emailValState === 'invalid' || emailValState === 'checking'}
                    >
                      {isLoading ? 'Submitting…' : 'Request Access'}
                    </button>
                  </div>

                </form>

                <p className="reg-login-hint">
                  Already have an account? <Link to="/" className="reg-login-link">Sign in</Link>
                </p>
              </>
            )}

          </div>
        </div>
      </div>

    </div>
  );
};

export default Register;
