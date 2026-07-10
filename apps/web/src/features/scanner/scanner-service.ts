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
};
