import { apiClient } from "@/services/api-client";

export type CulqiChargeCreateRequest = {
  payment_session_id: string;
  token_id: string;
  email: string;
};

export type CulqiChargeResponse = {
  payment_id: string;
  payment_session_id: string;
  sale_id: string;
  status: string;
  message: string;
};

export type CulqiOrderCreateRequest = {
  payment_session_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
};

export type CulqiOrderCreateResponse = {
  payment_session_id: string;
  sale_id: string;
  culqi_order_id: string;
  amount: number;
  currency: string;
  state: string;
  payment_code: string | null;
  message: string;
};

export type CulqiOrderConfirmRequest = {
  payment_session_id: string;
  culqi_order_id: string;
};

export type CulqiOrderConfirmResponse = {
  payment_id: string | null;
  payment_session_id: string;
  sale_id: string;
  culqi_order_id: string;
  status: string;
  order_state: string;
  message: string;
};

export const culqiService = {
  createCharge(payload: CulqiChargeCreateRequest): Promise<CulqiChargeResponse> {
    return apiClient.post<CulqiChargeResponse, CulqiChargeCreateRequest>(
      "/culqi/charges",
      payload,
    );
  },

  createOrder(
    payload: CulqiOrderCreateRequest,
  ): Promise<CulqiOrderCreateResponse> {
    return apiClient.post<CulqiOrderCreateResponse, CulqiOrderCreateRequest>(
      "/culqi/orders",
      payload,
    );
  },

  confirmOrder(
    payload: CulqiOrderConfirmRequest,
  ): Promise<CulqiOrderConfirmResponse> {
    return apiClient.post<CulqiOrderConfirmResponse, CulqiOrderConfirmRequest>(
      "/culqi/orders/confirm",
      payload,
    );
  },
};
