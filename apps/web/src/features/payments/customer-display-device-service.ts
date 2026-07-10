import { apiClient } from "@/services/api-client";

export type CustomerDisplayDevice = {
  id: string;
  device_name: string;
  is_active: boolean;
  last_seen_at: string | null;
  paired_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PairingCodeCreateRequest = {
  device_name: string;
};

export type PairingCodeCreateResponse = {
  pairing_code_id: string;
  device_name: string;
  code: string;
  expires_at: string;
};

export type PairCustomerDisplayDeviceRequest = {
  code: string;
};

export type PairCustomerDisplayDeviceResponse = {
  device_id: string;
  device_name: string;
  device_token: string;
};

export type CustomerDisplayDeviceTokenRequest = {
  device_id: string;
  device_token: string;
};

export type CustomerDisplayDeviceStatusResponse = {
  device_id: string;
  device_name: string;
  is_active: boolean;
  last_seen_at: string | null;
};

export const customerDisplayDeviceService = {
  listDevices(token: string): Promise<CustomerDisplayDevice[]> {
    return apiClient.get<CustomerDisplayDevice[]>("/customer-display-devices", {
      token,
    });
  },

  createPairingCode(
    payload: PairingCodeCreateRequest,
    token: string,
  ): Promise<PairingCodeCreateResponse> {
    return apiClient.post<
      PairingCodeCreateResponse,
      PairingCodeCreateRequest
    >("/customer-display-devices/pairing-codes", payload, {
      token,
    });
  },

  pairDevice(
    payload: PairCustomerDisplayDeviceRequest,
  ): Promise<PairCustomerDisplayDeviceResponse> {
    return apiClient.post<
      PairCustomerDisplayDeviceResponse,
      PairCustomerDisplayDeviceRequest
    >("/customer-display-devices/pair", payload);
  },

  validateDevice(
    payload: CustomerDisplayDeviceTokenRequest,
  ): Promise<CustomerDisplayDeviceStatusResponse> {
    return apiClient.post<
      CustomerDisplayDeviceStatusResponse,
      CustomerDisplayDeviceTokenRequest
    >("/customer-display-devices/validate", payload);
  },

  deactivateDevice(
    deviceId: string,
    token: string,
  ): Promise<CustomerDisplayDevice> {
    return apiClient.patch<CustomerDisplayDevice, Record<string, never>>(
      `/customer-display-devices/${deviceId}/deactivate`,
      {},
      {
        token,
      },
    );
  },
};
