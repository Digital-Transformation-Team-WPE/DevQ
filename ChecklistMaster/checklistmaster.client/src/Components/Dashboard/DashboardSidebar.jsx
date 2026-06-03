import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { roleLabel, roleColor } from "../../utils/permissions";

const I = (d) => (
  <svg className="dash-nav-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const icons = {
  home:      I(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  users:     I(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  folder:    I(<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>),
  list:      I(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>),
  check:     I(<><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>),
  milestone: I(<><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></>),
  doc:       I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>),
  chart:     I(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>),
  calendar:  I(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  settings:  I(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
  account:   I(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  shield:    I(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>),
};

// Arrow icon for collapsible group
const ArrowIcon = ({ open }) => (
  <svg className="dash-nav-arrow" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const account = { l:"My Account", icon:icons.account, p:"/dashboard/settings" };

// Admin sub-items
const ADMIN_SUB = [
  { l:"Checklist Master", icon:icons.check,     p:"/dashboard/checklists" },
  { l:"Milestones",       icon:icons.milestone, p:"/dashboard/milestones" },
  { l:"Users Info",       icon:icons.users,     p:"/dashboard/users" },
];

// Top-level nav per role
const NAV = {
  Admin: [
    { l:"Home",       icon:icons.home,     p:"/dashboard" },
    { l:"Projects",   icon:icons.folder,   p:"/dashboard/projects" },
    { l:"Issue List", icon:icons.list,     p:"/dashboard/issues" },
    { l:"Calendar",   icon:icons.calendar, p:"/dashboard/calendar" },
    { l:"Admin",      icon:icons.shield,   p:null, sub: ADMIN_SUB },
    { l:"Reports",    icon:icons.chart,    p:"/dashboard/reports" },
    { l:"Settings",   icon:icons.settings, p:"/dashboard/settings" },
  ],
  AVP_Admin: [
    { l:"Home",       icon:icons.home,     p:"/dashboard" },
    { l:"Projects",   icon:icons.folder,   p:"/dashboard/projects" },
    { l:"Issue List", icon:icons.list,     p:"/dashboard/issues" },
    { l:"Calendar",   icon:icons.calendar, p:"/dashboard/calendar" },
    { l:"Reports",    icon:icons.chart,    p:"/dashboard/reports" },
    account,
  ],
  WGDE_Admin: [
    { l:"Home",             icon:icons.home,      p:"/dashboard" },
    { l:"Projects",         icon:icons.folder,    p:"/dashboard/projects" },
    { l:"Issue List",       icon:icons.list,      p:"/dashboard/issues" },
    { l:"Master Checklist", icon:icons.check,     p:"/dashboard/checklists" },
    { l:"Milestones",       icon:icons.milestone, p:"/dashboard/milestones" },
    { l:"Calendar",         icon:icons.calendar,  p:"/dashboard/calendar" },
    { l:"Reports",          icon:icons.chart,     p:"/dashboard/reports" },
    account,
  ],
  AVP_User: [
    { l:"Home",       icon:icons.home,     p:"/dashboard" },
    { l:"Projects",   icon:icons.folder,   p:"/dashboard/projects" },
    { l:"Issue List", icon:icons.list,     p:"/dashboard/issues" },
    { l:"Calendar",   icon:icons.calendar, p:"/dashboard/calendar" },
    { l:"Reports",    icon:icons.chart,    p:"/dashboard/reports" },
    account,
  ],
  WGDE_User: [
    { l:"Home",             icon:icons.home,      p:"/dashboard" },
    { l:"Projects",         icon:icons.folder,    p:"/dashboard/projects" },
    { l:"Issue List",       icon:icons.list,      p:"/dashboard/issues" },
    { l:"Master Checklist", icon:icons.check,     p:"/dashboard/checklists" },
    { l:"Milestones",       icon:icons.milestone, p:"/dashboard/milestones" },
    { l:"Calendar",         icon:icons.calendar,  p:"/dashboard/calendar" },
    account,
  ],
  Viewer: [
    { l:"Home",             icon:icons.home,      p:"/dashboard" },
    { l:"Projects",         icon:icons.folder,    p:"/dashboard/projects" },
    { l:"Issue List",       icon:icons.list,      p:"/dashboard/issues" },
    { l:"Master Checklist", icon:icons.check,     p:"/dashboard/checklists" },
    { l:"Calendar",         icon:icons.calendar,  p:"/dashboard/calendar" },
    { l:"Reports",          icon:icons.chart,     p:"/dashboard/reports" },
    account,
  ],
};

const DashboardSidebar = ({ collapsed, onExpand }) => {
  const { user }   = useAuth();
  const location   = useLocation();
  const navigate   = useNavigate();
  const navItems   = NAV[user?.role] ?? NAV.Viewer;
  const isActive   = (p) => !p ? false : p === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(p);
  const isSubActive = (sub) => sub?.some(s => isActive(s.p));

  const [adminOpen, setAdminOpen] = useState(() => isSubActive(ADMIN_SUB));

  const role  = user?.role ?? 'Viewer';
  const color = roleColor(role);
  const label = roleLabel(role);
  const dept  = { AVP_Admin:'AVP', WGDE_Admin:'WGDE', AVP_User:'AVP', WGDE_User:'WGDE' }[role];

  return (
    <aside className={`dash-sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="dash-sidebar-header">{!collapsed ? "Navigation" : ""}</div>
      <nav className="dash-nav">
        {navItems.map(item => {
          // Grouped item with sub-menu
          if (item.sub) {
            const groupActive = isSubActive(item.sub);
            return (
              <div key={item.l} className="dash-nav-group">
                <button
                  className={`dash-nav-item dash-nav-group-header${groupActive ? " active" : ""}`}
                  onClick={() => {
                    if (collapsed) { onExpand?.(); setAdminOpen(true); }
                    else setAdminOpen(o => !o);
                  }}
                  title={collapsed ? item.l : undefined}>
                  {item.icon}
                  <span className="dash-nav-label">{item.l}</span>
                  {!collapsed && <ArrowIcon open={adminOpen} />}
                </button>
                {!collapsed && (adminOpen || groupActive) && (
                  <div className="dash-nav-sublist">
                    {item.sub.map(sub => (
                      <button key={sub.p}
                        className={`dash-nav-item dash-nav-subitem${isActive(sub.p) ? " active" : ""}`}
                        onClick={() => navigate(sub.p)}
                        title={sub.l}>
                        {sub.icon}
                        <span className="dash-nav-label">{sub.l}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          // Regular item
          return (
            <button key={item.p}
              className={`dash-nav-item${isActive(item.p) ? " active" : ""}`}
              onClick={() => navigate(item.p)}
              title={collapsed ? item.l : undefined}>
              {item.icon}
              <span className="dash-nav-label">{item.l}</span>
            </button>
          );
        })}
      </nav>

      <div className={`dash-role-badge${collapsed ? " collapsed" : ""}`} title={label}>
        <span className="dash-role-dot" style={{ background: color }}/>
        {!collapsed && (
          <div className="dash-role-text">
            <span className="dash-role-name">{label}</span>
            {dept && <span className="dash-role-dept">{dept} dept</span>}
          </div>
        )}
      </div>
    </aside>
  );
};
export default DashboardSidebar;
