import { apiClient } from "@/services/api-client";
import type { ReturnTransaction } from "@/types/api";

export type ReturnTransactionCreate = {
  original_sale_id: string;
  transaction_type: "RETURN" | "EXCHANGE";
  reason: string;
  item_condition: string;
  inventory_resolution: string;
  settlement_method: string | null;
  settlement_reference: string | null;
  settlement_device_id: string | null;
  notes: string | null;
  items: Array<{ sale_item_id: string; quantity: number }>;
  replacements: Array<{ product_variant_id: string; quantity: number }>;
};

export const returnService = {
  list(token: string) {
    return apiClient.get<ReturnTransaction[]>("/returns", { token });
  },
  create(payload: ReturnTransactionCreate, token: string) {
    return apiClient.post<ReturnTransaction, ReturnTransactionCreate>(
      "/returns",
      payload,
      { token },
    );
  },
  cancel(transactionId: string, token: string) {
    return apiClient.patch<ReturnTransaction, Record<string, never>>(
      `/returns/${transactionId}/cancel`,
      {},
      { token },
    );
  },
};
