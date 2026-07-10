import { apiClient } from "@/services/api-client";
import type { PaymentSession, Sale } from "@/types/api";

export const customerDisplayService = {
  listActiveSessions(
    deviceId: string,
    deviceToken: string,
  ): Promise<PaymentSession[]> {
    return apiClient.get<PaymentSession[]>(
      `/customer-display/sessions/${deviceId}`,
      {
        headers: {
          "X-Device-Token": deviceToken,
        },
      },
    );
  },

  getReceipt(
    deviceId: string,
    deviceToken: string,
    paymentSessionId: string,
  ): Promise<Sale> {
    return apiClient.get<Sale>(
      `/customer-display/sessions/${deviceId}/${paymentSessionId}/receipt`,
      {
        headers: {
          "X-Device-Token": deviceToken,
        },
      },
    );
  },
};
