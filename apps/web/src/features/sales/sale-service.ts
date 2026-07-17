import { apiClient } from "@/services/api-client";
import type {
  Customer,
  PaymentSession,
  ProductVariant,
  Sale,
} from "@/types/api";
import type { CustomerDisplayDevice } from "@/features/payments/customer-display-device-service";

export type SaleItemCreateRequest = {
  product_variant_id: string;
  quantity: number;
  discount_amount: string;
};

export type SaleCreateRequest = {
  customer_id?: string | null;
  items: SaleItemCreateRequest[];
  discount_total: string;
  tax_total: string;
  notes?: string | null;
};

export type PaymentSessionCreateRequest = {
  sale_id: string;
  device_id: string;
  customer_message?: string | null;
  receipt_email?: string | null;
  expires_in_minutes: number;
};

export const saleService = {
  listCustomers(token: string): Promise<Customer[]> {
    return apiClient.get<Customer[]>("/customers", {
      token,
    });
  },

  listVariants(token: string): Promise<ProductVariant[]> {
    return apiClient.get<ProductVariant[]>("/product-variants", {
      token,
    });
  },

  listSales(token: string): Promise<Sale[]> {
    return apiClient.get<Sale[]>("/sales", {
      token,
    });
  },

  getSale(saleId: string, token: string): Promise<Sale> {
    return apiClient.get<Sale>(`/sales/${saleId}`, {
      token,
    });
  },

  listCustomerDisplayDevices(token: string): Promise<CustomerDisplayDevice[]> {
    return apiClient.get<CustomerDisplayDevice[]>("/customer-display-devices", {
      token,
    });
  },

  createSale(payload: SaleCreateRequest, token: string): Promise<Sale> {
    return apiClient.post<Sale, SaleCreateRequest>("/sales", payload, {
      token,
    });
  },

  cancelSale(saleId: string, token: string): Promise<Sale> {
    return apiClient.patch<Sale, Record<string, never>>(
      `/sales/${saleId}/cancel`,
      {},
      { token },
    );
  },

  createPaymentSession(
    payload: PaymentSessionCreateRequest,
    token: string,
  ): Promise<PaymentSession> {
    return apiClient.post<PaymentSession, PaymentSessionCreateRequest>(
      "/payment-sessions",
      payload,
      {
        token,
      },
    );
  },
};
