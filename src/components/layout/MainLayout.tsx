import { Outlet } from "react-router";
import AppNavigation from "@/components/layout/AppNavigation";

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-stone-100 via-orange-50 to-emerald-100 text-foreground">
      <AppNavigation />
      <Outlet />
    </div>
  );
};

export default MainLayout;