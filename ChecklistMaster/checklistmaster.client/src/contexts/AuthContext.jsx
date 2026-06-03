import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authApi } from "../services/apiService";

const AuthContext = createContext(null);

const IDLE_MS      = 30 * 60 * 1000; // 30 minutes of inactivity → auto-logout
const WARN_MS      = 30 * 1000;       // warn 30 s before logout
const IDLE_EVENTS  = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [warnVisible, setWarnVisible] = useState(false);

  const idleTimerRef = useRef(null);
  const warnTimerRef = useRef(null);

  const clearTimers = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
  };

  const logout = useCallback(async () => {
    clearTimers();
    setWarnVisible(false);
    try { await authApi.logout(); } catch { /* ignore */ }
    setUser(null);
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearTimers();
    setWarnVisible(false);
    // warn banner appears at (IDLE_MS - WARN_MS) of inactivity
    warnTimerRef.current = setTimeout(() => setWarnVisible(true), IDLE_MS - WARN_MS);
    // actual logout fires at IDLE_MS
    idleTimerRef.current = setTimeout(() => logout(), IDLE_MS);
  }, [logout]);

  // Attach activity listeners when a user is logged in
  useEffect(() => {
    if (!user) {
      clearTimers();
      setWarnVisible(false);
      return;
    }
    IDLE_EVENTS.forEach(ev => window.addEventListener(ev, resetIdleTimer, { passive: true }));
    resetIdleTimer(); // start the timer immediately after login
    return () => {
      IDLE_EVENTS.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
      clearTimers();
    };
  }, [user, resetIdleTimer]);

  // Restore session from the HttpOnly cookie on every page load
  useEffect(() => {
    authApi.me()
      .then((data) => {
        if (data?.success && data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401 session-expired events from the API client
  useEffect(() => {
    const handle = () => {
      clearTimers();
      setWarnVisible(false);
      setUser(null);
      try { authApi.logout(); } catch { /* ignore */ }
    };
    window.addEventListener('cm:session-expired', handle);
    return () => window.removeEventListener('cm:session-expired', handle);
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
      {warnVisible && user && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'#c62828', color:'#fff', padding:'12px 24px', borderRadius:8,
          fontSize:13, fontWeight:600, zIndex:99999, boxShadow:'0 4px 20px rgba(0,0,0,.3)',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <span>⚠ No activity — logging out in 30 seconds</span>
          <button
            onClick={resetIdleTimer}
            style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',padding:'4px 12px',borderRadius:5,cursor:'pointer',fontWeight:700,fontFamily:'inherit',fontSize:12}}>
            Stay logged in
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
