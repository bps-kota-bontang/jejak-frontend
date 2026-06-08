import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/providers/AuthProvider";

const ProtectedRoute = ({ children, requiredRoles = [] }: { children: ReactNode; requiredRoles?: string[] }) => {
  const { isAuthenticated, isInitializing, hasAnyRole } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Memuat sesi...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;