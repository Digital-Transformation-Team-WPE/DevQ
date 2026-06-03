import { useState, Component } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canAccess } from "../../utils/permissions";
import DashboardHeader  from "./DashboardHeader";
import DashboardSidebar from "./DashboardSidebar";
import DashboardFooter  from "./DashboardFooter";
import Checklists          from "../Checklists/Checklists";
import Users               from "../UserManagement/Users";
import Projects            from "../Projects/Projects";
import ProjectDetail        from "../Projects/ProjectDetail";
import Issues              from "../Issues/Issues";
import IssueManage         from "../Issues/IssueManage";
import ChecklistMilestones from "../ChecklistMilestones/ChecklistMilestones";
import DmrsChecklists      from "../Dmrs/DmrsChecklists";
import DmrsManage          from "../Dmrs/DmrsManage";
import DmrsProjectReport   from "../Projects/DmrsProjectReport";
import HomeDashboard       from "./HomeDashboard";
import UserSettings        from "../UserSettings/UserSettings";
import Calendar            from "../Calendar/Calendar";
import Reports             from "../Reports/Reports";
import "./Dashboard.css";

/** Catches render errors in child routes so the header/sidebar stay visible. */
class RouteErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:'40px 24px',textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:700,color:'#c62828',marginBottom:8}}>Something went wrong</div>
          <div style={{fontSize:13,color:'#888',marginBottom:16}}>{this.state.error?.message || 'An unexpected error occurred.'}</div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{padding:'8px 20px',background:'#3f51b5',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:13}}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Redirects to /dashboard when the user's role lacks access to a module. */
const RoleRoute = ({ module, children }) => {
  const { user } = useAuth();
  return canAccess(user?.role ?? 'Viewer', module)
    ? children
    : <Navigate to="/dashboard" replace/>;
};

const Page = ({ title }) => (
  <div style={{ background:"var(--dash-card-bg)", borderRadius:8, padding:"28px 24px", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
    <h2 style={{ margin:0, color:"var(--dash-header-bg)", fontSize:20 }}>{title}</h2>
    <p style={{ color:"#888", marginTop:8, fontSize:14 }}>Content for <strong>{title}</strong> will be implemented here.</p>
  </div>
);

const Dashboard = () => {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className="dash-shell">
      <DashboardHeader onBurgerClick={() => setCollapsed(p => !p)} />
      <div className="dash-body">
        <DashboardSidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} />
        <main className="dash-main">
          <RouteErrorBoundary>
          <Routes>
            <Route index element={<HomeDashboard />} />

            <Route path="users"
              element={<RoleRoute module="users"><Users /></RoleRoute>} />

            <Route path="projects"
              element={<RoleRoute module="projects"><Projects /></RoleRoute>} />
            <Route path="projects/:uid"
              element={<RoleRoute module="projects"><ProjectDetail /></RoleRoute>} />
            <Route path="projects/:uid/report"
              element={<RoleRoute module="projects"><DmrsProjectReport /></RoleRoute>} />

            <Route path="issues"
              element={<RoleRoute module="issues"><Issues /></RoleRoute>} />
            <Route path="issues/:uid"
              element={<RoleRoute module="issues"><IssueManage /></RoleRoute>} />

            <Route path="checklists"
              element={<RoleRoute module="checklists"><Checklists /></RoleRoute>} />

            <Route path="milestones"
              element={<RoleRoute module="milestones"><ChecklistMilestones /></RoleRoute>} />

            <Route path="dmrs"
              element={<RoleRoute module="dmrs"><DmrsChecklists /></RoleRoute>} />
            <Route path="dmrs/manage/:issueNumber"
              element={<RoleRoute module="dmrs"><DmrsManage /></RoleRoute>} />

            <Route path="calendar"
              element={<Calendar />} />

            <Route path="reports"
              element={<RoleRoute module="reports"><Reports /></RoleRoute>} />
            <Route path="settings"
              element={<UserSettings />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </RouteErrorBoundary>
        </main>
      </div>
      <DashboardFooter />
    </div>
  );
};
export default Dashboard;
