import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getNavItemClass(isActive: boolean): string {
  return [
    "border-b-2 px-2 py-1 text-sm leading-none transition-colors",
    isActive
      ? "border-primary text-foreground font-semibold"
      : "border-transparent text-muted-foreground hover:text-foreground",
  ].join(" ");
}

const AppNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasAnyRole, logout } = useAuth();
  const isAdmin = hasAnyRole(["admin"]);
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await logout();
    } finally {
      setLogoutLoading(false);
      navigate("/login", { replace: true });
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-linear-to-br from-stone-100 via-orange-50 to-emerald-100">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2.5 md:px-6">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1">
            Jejak
          </Badge>
          <nav className="flex items-center gap-3" aria-label="Menu utama">
            <Link
              to="/surveys"
              className={getNavItemClass(location.pathname.startsWith("/surveys"))}
              aria-current={location.pathname.startsWith("/surveys") ? "page" : undefined}
            >
              Survey
            </Link>
            <Link
              to="/areas"
              className={getNavItemClass(location.pathname.startsWith("/areas"))}
              aria-current={location.pathname.startsWith("/areas") ? "page" : undefined}
            >
              Area
            </Link>
            {isAdmin && (
              <Link
                to="/users"
                className={getNavItemClass(location.pathname.startsWith("/users"))}
                aria-current={location.pathname.startsWith("/users") ? "page" : undefined}
              >
                User
              </Link>
            )}
          </nav>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleLogout()}
          disabled={logoutLoading}
        >
          {logoutLoading ? "Keluar..." : "Logout"}
        </Button>
      </div>
    </header>
  );
};

export default AppNavigation;