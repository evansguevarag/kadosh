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

export type ReturnCulqiOrderResponse = {
  settlement_session_id: string;
  return_transaction_id: string;
  culqi_order_id: string;
  amount: number;
  currency: string;
  status: string;
  order_state: string;
  message: string;
};

export type ReturnCulqiChargeResponse = {
  settlement_session_id: string;
  return_transaction_id: string;
  culqi_charge_id: string | null;
  status: string;
  message: string;
};

export const culqiService = {
  createReturnCharge(
    settlementSessionId: string,
    tokenId: string,
    email: string,
    deviceId: string,
    deviceToken: string,
  ): Promise<ReturnCulqiChargeResponse> {
    return apiClient.post<
      ReturnCulqiChargeResponse,
      { settlement_session_id: string; token_id: string; email: string }
    >(
      "/return-culqi/charges",
      { settlement_session_id: settlementSessionId, token_id: tokenId, email },
      { headers: { "X-Device-Id": deviceId, "X-Device-Token": deviceToken } },
    );
  },

  createCharge(
    payload: CulqiChargeCreateRequest,
    deviceId: string,
    deviceToken: string,
  ): Promise<CulqiChargeResponse> {
    return apiClient.post<CulqiChargeResponse, CulqiChargeCreateRequest>(
      "/culqi/charges",
      payload,
      { headers: { "X-Device-Id": deviceId, "X-Device-Token": deviceToken } },
    );
  },

  createOrder(
    payload: CulqiOrderCreateRequest,
    deviceId: string,
    deviceToken: string,
  ): Promise<CulqiOrderCreateResponse> {
    return apiClient.post<CulqiOrderCreateResponse, CulqiOrderCreateRequest>(
      "/culqi/orders",
      payload,
      { headers: { "X-Device-Id": deviceId, "X-Device-Token": deviceToken } },
    );
  },

  confirmOrder(
    payload: CulqiOrderConfirmRequest,
    deviceId: string,
    deviceToken: string,
  ): Promise<CulqiOrderConfirmResponse> {
    return apiClient.post<CulqiOrderConfirmResponse, CulqiOrderConfirmRequest>(
      "/culqi/orders/confirm",
      payload,
      { headers: { "X-Device-Id": deviceId, "X-Device-Token": deviceToken } },
    );
  },

  createReturnOrder(
    settlementSessionId: string,
    email: string,
    deviceId: string,
    deviceToken: string,
  ): Promise<ReturnCulqiOrderResponse> {
    return apiClient.post<ReturnCulqiOrderResponse, { settlement_session_id: string; email: string }>(
      "/return-culqi/orders",
      { settlement_session_id: settlementSessionId, email },
      { headers: { "X-Device-Id": deviceId, "X-Device-Token": deviceToken } },
    );
  },

  confirmReturnOrder(
    settlementSessionId: string,
    culqiOrderId: string,
    deviceId: string,
    deviceToken: string,
  ): Promise<ReturnCulqiOrderResponse> {
    return apiClient.post<ReturnCulqiOrderResponse, { settlement_session_id: string; culqi_order_id: string }>(
      "/return-culqi/orders/confirm",
      { settlement_session_id: settlementSessionId, culqi_order_id: culqiOrderId },
      { headers: { "X-Device-Id": deviceId, "X-Device-Token": deviceToken } },
    );
  },
};
