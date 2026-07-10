"use client";

import { useEffect, useState } from "react";

import { authService } from "@/features/auth/auth-service";
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

export function useAuth(): UseAuthResult {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAuthState(getStoredAuthState());
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

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

  return {
    ...authState,
    isAuthenticated:
      authState.status === "loading" ||
      authState.status === "authenticated",
    login,
    logout,
  };
}
