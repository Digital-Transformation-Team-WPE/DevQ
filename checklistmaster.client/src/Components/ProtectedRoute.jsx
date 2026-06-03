import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f7f8fc", color:"#2F2F7F", fontSize:16 }}>
      Loading session\u2026
    </div>
  );
  if (!user) return <Navigate to="/" state={{ from: location }} replace />;
  return children;
};
export default ProtectedRoute;
