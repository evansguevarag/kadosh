import { apiClient } from "@/services/api-client";

export type ScannerSession = {
  id: string;
  pairing_token: string;
  expires_at: string;
};

export type ScannerScan = {
  id: string;
  code: string;
  created_at: string;
};

export type ScannerSessionPoll = {
  session_id: string;
  scans: ScannerScan[];
};

const SCANNER_SESSION_STORAGE_KEY = "kadosh_scanner_session";
const SCANNER_LAST_SCAN_STORAGE_KEY = "kadosh_scanner_last_scan";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export const scannerService = {
  createSession(token: string): Promise<ScannerSession> {
    return apiClient.post<ScannerSession, Record<string, never>>(
      "/scanner-sessions",
      {},
      { token },
    );
  },

  pollSession(
    sessionId: string,
    token: string,
    afterScanId?: string | null,
  ): Promise<ScannerSessionPoll> {
    const query = afterScanId ? `?after_scan_id=${afterScanId}` : "";

    return apiClient.get<ScannerSessionPoll>(
      `/scanner-sessions/${sessionId}/scans${query}`,
      { token },
    );
  },

  registerScan(
    sessionId: string,
    pairingToken: string,
    code: string,
  ): Promise<ScannerScan> {
    return apiClient.post<
      ScannerScan,
      {
        pairing_token: string;
        code: string;
      }
    >(`/scanner-sessions/${sessionId}/scans`, {
      pairing_token: pairingToken,
      code,
    });
  },

  saveSession(session: ScannerSession): void {
    if (!canUseStorage()) return;

    window.localStorage.setItem(
      SCANNER_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  },

  getStoredSession(): ScannerSession | null {
    if (!canUseStorage()) return null;

    const rawSession = window.localStorage.getItem(SCANNER_SESSION_STORAGE_KEY);

    if (!rawSession) return null;

    try {
      const session = JSON.parse(rawSession) as ScannerSession;

      if (
        !session.id ||
        !session.pairing_token ||
        !session.expires_at ||
        new Date(session.expires_at).getTime() <= Date.now()
      ) {
        this.clearStoredSession();
        return null;
      }

      return session;
    } catch {
      this.clearStoredSession();
      return null;
    }
  },

  saveLastScanId(sessionId: string, scanId: string | null): void {
    if (!canUseStorage()) return;

    if (!scanId) {
      window.localStorage.removeItem(SCANNER_LAST_SCAN_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SCANNER_LAST_SCAN_STORAGE_KEY,
      JSON.stringify({ sessionId, scanId }),
    );
  },

  getLastScanId(sessionId: string): string | null {
    if (!canUseStorage()) return null;

    const rawCursor = window.localStorage.getItem(
      SCANNER_LAST_SCAN_STORAGE_KEY,
    );

    if (!rawCursor) return null;

    try {
      const cursor = JSON.parse(rawCursor) as {
        sessionId?: string;
        scanId?: string;
      };

      return cursor.sessionId === sessionId && cursor.scanId
        ? cursor.scanId
        : null;
    } catch {
      return null;
    }
  },

  clearStoredSession(): void {
    if (!canUseStorage()) return;

    window.localStorage.removeItem(SCANNER_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SCANNER_LAST_SCAN_STORAGE_KEY);
  },
};
