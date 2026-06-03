import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const WARN = 60 * 60 * 1000; const DANGER = 8 * 60 * 1000;
const fmt = (ms) => { if (ms <= 0) return "00:00"; const s = Math.floor(ms/1000); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };
const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

const DashboardFooter = () => {
  const { sessionExpiresAt, logout } = useAuth();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const tick = () => {
      const rem = sessionExpiresAt - Date.now();
      if (rem <= 0) { logout().then(() => navigate("/", { replace: true })); return; }
      setRemaining(rem);
      setShowBanner(rem <= WARN && rem > DANGER);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionExpiresAt, logout, navigate]);

  const cls = remaining === null ? "" : remaining <= DANGER ? "danger" : remaining <= WARN ? "warn" : "";

  return (
    <>
      {showBanner && (
        <div className="session-warn-banner" role="alert">
          Your session expires in <strong>{fmt(remaining ?? 0)}</strong>. Please save your work.
        </div>
      )}
      <footer className="dash-footer">
        <span>Copyright {new Date().getFullYear()} Stellantis - R Studio. All rights reserved.</span>
        <div className="dash-footer-center">
          {remaining !== null && (
            <div className={`session-timer ${cls}`} title="Session time remaining">
              <ClockIcon /> Session: {fmt(remaining)}
            </div>
          )}
        </div>
        <span>v1.0.0</span>
      </footer>
    </>
  );
};
export default DashboardFooter;
