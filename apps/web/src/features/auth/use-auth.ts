"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { authService } from "@/features/auth/auth-service";
import { AUTH_UNAUTHORIZED_EVENT } from "@/services/api-client";
import type { AuthUser, LoginRequest } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
};

type UseAuthResult = AuthState & {
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
};

const initialAuthState: AuthState = {
  user: null,
  token: null,
  status: "loading",
};

const AuthContext = createContext<UseAuthResult | null>(null);

function getStoredAuthState(): AuthState {
  const storedToken = authService.getAccessToken();
  const storedUser = authService.getStoredUser();

  if (!storedToken || !storedUser) {
    return {
      user: null,
      token: null,
      status: "unauthenticated",
    };
  }

  return {
    user: storedUser,
    token: storedToken,
    status: "authenticated",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);

  useEffect(() => {
    let isActive = true;
    const storedState = getStoredAuthState();

    if (storedState.status === "unauthenticated" || !storedState.token) {
      queueMicrotask(() => {
        if (isActive) {
          setAuthState(storedState);
        }
      });

      return () => {
        isActive = false;
      };
    }

    authService
      .getCurrentUser(storedState.token)
      .then((user) => {
        if (!isActive) return;

        authService.saveUser(user);
        setAuthState({
          user,
          token: storedState.token,
          status: "authenticated",
        });
      })
      .catch(() => {
        if (!isActive) return;

        authService.logout();
        setAuthState({
          user: null,
          token: null,
          status: "unauthenticated",
        });
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      authService.logout();
      setAuthState({
        user: null,
        token: null,
        status: "unauthenticated",
      });

      if (pathname !== "/login" && pathname !== "/forgot-password") {
        router.replace("/login");
      }
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [pathname, router]);

  async function login(payload: LoginRequest): Promise<void> {
    const response = await authService.login(payload);

    authService.saveSession(response);

    setAuthState({
      user: response.user ?? authService.getStoredUser(),
      token: response.access_token,
      status: "authenticated",
    });
  }

  function logout(): void {
    authService.logout();

    setAuthState({
      user: null,
      token: null,
      status: "unauthenticated",
    });
  }

  const value: UseAuthResult = {
    ...authState,
    isAuthenticated:
      authState.status === "loading" ||
      authState.status === "authenticated",
    login,
    logout,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): UseAuthResult {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}
