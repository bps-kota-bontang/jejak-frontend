import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/providers/AuthProvider";

const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Memuat sesi...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/surveys" replace />;
  }

  return <>{children}</>;
};

export default PublicOnlyRoute;