import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AUTH_EVENT_UNAUTHORIZED } from "@/lib/http-client";
import {
  clearAuthSession,
  getAccessToken,
  loginWithSSO as loginWithSSORequest,
  logout as logoutRequest,
  refreshAccessToken,
} from "@/services/auth";
import type { LoginSSORequest } from "@/types/auth";
import { getRolesFromToken, hasAnyRole, hasRole } from "@/utils/authz";

type AuthContextType = {
  isInitializing: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  roles: string[];
  hasRole: (role: string) => boolean;
  hasAnyRole: (requiredRoles: string[]) => boolean;
  loginWithSSO: (payload: LoginSSORequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const [isInitializing, setIsInitializing] = useState(true);

  const loginWithSSO = useCallback(async (payload: LoginSSORequest) => {
    const token = await loginWithSSORequest(payload);
    setAccessToken(token);
    setIsInitializing(false);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setAccessToken(null);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      try {
        const token = await refreshAccessToken();
        if (mounted) {
          setAccessToken(token);
        }
      } catch {
        if (mounted) {
          setAccessToken(null);
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthSession();
      setAccessToken(null);
      setIsInitializing(false);
    };

    window.addEventListener(AUTH_EVENT_UNAUTHORIZED, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_EVENT_UNAUTHORIZED, handleUnauthorized);
    };
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const roles = getRolesFromToken(accessToken);

    return {
      isInitializing,
      isAuthenticated: Boolean(accessToken),
      accessToken,
      roles,
      hasRole: (role: string) => hasRole(roles, role),
      hasAnyRole: (requiredRoles: string[]) => hasAnyRole(roles, requiredRoles),
      loginWithSSO,
      logout,
    };
  }, [accessToken, isInitializing, loginWithSSO, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }

  return context;
};