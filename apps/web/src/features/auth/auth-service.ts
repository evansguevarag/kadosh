import { apiClient } from "@/services/api-client";
import { clearPosWorkspaceStorage } from "@/features/pos/pos-workspace-storage";
import { scannerService } from "@/features/scanner/scanner-service";
import type {
  AuthUser,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  PasswordResetVerifyRequest,
  TokenResponse,
} from "@/types/api";

const ACCESS_TOKEN_STORAGE_KEY = "kadosh_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "kadosh_refresh_token";
const AUTH_USER_STORAGE_KEY = "kadosh_auth_user";

type AuthUserApiResponse = AuthUser & {
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  role_name?: string | null;
  full_name?: string | null;
};

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function normalizeAuthUser(user: AuthUserApiResponse): AuthUser {
  const firstName = user.first_name?.trim() ?? "";
  const lastName = user.last_name?.trim() ?? "";
  const generatedFullName = `${firstName} ${lastName}`.trim();

  return {
    ...user,
    full_name: user.full_name || generatedFullName || user.email,
    role_name: user.role_name || user.role || "ADMIN",
  };
}

export const authService = {
  async login(payload: LoginRequest): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse, LoginRequest>(
      "/auth/login",
      payload,
    );

    this.saveTokens(response.access_token, response.refresh_token);

    const currentUser = await this.getCurrentUser(response.access_token);

    this.saveUser(currentUser);

    return {
      ...response,
      user: currentUser,
    };
  },

  requestPasswordReset(
    payload: PasswordResetRequest,
  ): Promise<PasswordResetResponse> {
    return apiClient.post<PasswordResetResponse, PasswordResetRequest>(
      "/auth/password-reset/request",
      payload,
    );
  },

  verifyPasswordResetOtp(
    payload: PasswordResetVerifyRequest,
  ): Promise<PasswordResetResponse> {
    return apiClient.post<PasswordResetResponse, PasswordResetVerifyRequest>(
      "/auth/password-reset/verify",
      payload,
    );
  },

  confirmPasswordReset(
    payload: PasswordResetConfirmRequest,
  ): Promise<PasswordResetResponse> {
    return apiClient.post<PasswordResetResponse, PasswordResetConfirmRequest>(
      "/auth/password-reset/confirm",
      payload,
    );
  },

  refreshSession(): Promise<TokenResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return Promise.reject(new Error("No hay una sesion para renovar."));
    }
    return apiClient
      .post<TokenResponse, { refresh_token: string }>("/auth/refresh", {
        refresh_token: refreshToken,
      })
      .then((response) => {
        this.saveSession(response);
        return response;
      });
  },

  getCurrentUser(token?: string | null): Promise<AuthUser> {
    return apiClient
      .get<AuthUserApiResponse>("/auth/me", {
        token,
      })
      .then(normalizeAuthUser);
  },

  saveSession(response: TokenResponse): void {
    this.saveTokens(response.access_token, response.refresh_token);

    if (response.user) {
      this.saveUser(normalizeAuthUser(response.user));
    }
  },

  saveTokens(accessToken: string, refreshToken: string): void {
    if (!canUseBrowserStorage()) {
      return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  },

  saveUser(user: AuthUser): void {
    if (!canUseBrowserStorage()) {
      return;
    }

    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  },

  getAccessToken(): string | null {
    if (!canUseBrowserStorage()) {
      return null;
    }

    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  },

  getRefreshToken(): string | null {
    if (!canUseBrowserStorage()) {
      return null;
    }

    return window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },

  getStoredUser(): AuthUser | null {
    if (!canUseBrowserStorage()) {
      return null;
    }

    const rawUser = window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!rawUser) {
      return null;
    }

    try {
      return normalizeAuthUser(JSON.parse(rawUser) as AuthUserApiResponse);
    } catch {
      return null;
    }
  },

  logout(): void {
    if (!canUseBrowserStorage()) {
      return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
    scannerService.clearStoredSession();
    clearPosWorkspaceStorage();
  },
};
