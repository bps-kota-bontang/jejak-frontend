import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PublicOnlyRoute from "@/components/auth/PublicOnlyRoute";

const LoginPage = lazy(() => import("@/app/login/LoginPage"));
const UserManagementPage = lazy(() => import("@/app/UserManagementPage"));
const SurveyDetailPage = lazy(() => import("@/app/SurveyDetailPage"));
const SurveyListPage = lazy(() => import("@/app/SurveyListPage"));
const SurveyRegionDetailPage = lazy(
  () => import("@/app/SurveyRegionDetailPage"),
);
const AreaManagementPage = lazy(() => import("@/app/AreaManagementPage"));
const ForbiddenPage = lazy(() => import("@/app/errors/ForbiddenPage"));
const MainLayout = lazy(() => import("@/components/layout/MainLayout"));

export default function AppRouter() {
  return (
    <Suspense fallback={null}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/surveys" replace />} />
            <Route path="/surveys" element={<SurveyListPage />} />
            <Route path="/areas" element={<AreaManagementPage />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route
              path="/surveys/:surveyPeriodId"
              element={<SurveyDetailPage />}
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route
            path="/surveys/:surveyPeriodId/regions/:regionFullCode"
            element={
              <ProtectedRoute>
                <SurveyRegionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/surveys" replace />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}
