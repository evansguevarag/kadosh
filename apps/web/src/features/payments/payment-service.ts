import { apiClient } from "@/services/api-client";
import type { Payment, Sale } from "@/types/api";

export type PaymentCreateRequest = {
  sale_id: string;
  payment_method: string;
  amount: string;
  currency?: string;
  operation_code?: string | null;
};

export const paymentService = {
  listSales(token: string): Promise<Sale[]> {
    return apiClient.get<Sale[]>("/sales", {
      token,
    });
  },

  listPayments(token: string): Promise<Payment[]> {
    return apiClient.get<Payment[]>("/payments", {
      token,
    });
  },

  createPayment(payload: PaymentCreateRequest, token: string): Promise<Payment> {
    return apiClient.post<Payment, PaymentCreateRequest>(
      "/payments/manual",
      payload,
      {
        token,
      },
    );
  },
};
