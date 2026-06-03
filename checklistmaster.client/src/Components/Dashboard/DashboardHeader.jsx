import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import logoRight from "../../assets/stellantis-logo.jpg";

const Svg = ({ children }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const BurgerIcon   = () => <Svg><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></Svg>;
const NotifyIcon   = () => <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>;
const SettingsIcon = () => <Svg><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Svg>;
const LogoutIcon   = () => <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const ProfileIcon  = () => <Svg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>;

const DashboardHeader = ({ onBurgerClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleLogout   = async () => { setOpen(false); await logout(); navigate("/", { replace: true }); };
  const handleSettings = () => { setOpen(false); navigate("/dashboard/settings"); };

  const initials = (user?.userName ?? user?.userId ?? "U")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="dash-header">
      <button className="dash-burger" onClick={onBurgerClick} title="Toggle sidebar"><BurgerIcon /></button>
      <div className="dash-header-logo">
        <img src={logoRight} alt="Stellantis" />
        <span className="dash-app-name">Robust Studio</span>
      </div>
      <div className="dash-header-right">
        {/* <button className="dash-icon-btn" title="Notifications"><NotifyIcon /></button> */}
        <button className="dash-icon-btn" title="Settings"><SettingsIcon /></button>
        <div style={{ position: "relative" }} ref={ref}>
          <button className="dash-user-pill" onClick={() => setOpen(p => !p)}>
            <div className="dash-avatar">{initials}</div>
            <div className="dash-user-info">
              <span className="dash-user-name">{user?.userName || user?.userId || "User"}</span>
              <span className="dash-user-role">{(user?.role ?? "").replace("_", " ")}</span>
            </div>
          </button>
          {open && (
            <div className="dash-user-dropdown">
              <button className="dash-dropdown-item" onClick={handleSettings}><ProfileIcon />Profile</button>
              <button className="dash-dropdown-item" onClick={handleSettings}><SettingsIcon />Settings</button>
              <div className="dash-dropdown-divider" />
              <button className="dash-dropdown-item danger" onClick={handleLogout}><LogoutIcon />Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default DashboardHeader;
