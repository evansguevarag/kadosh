import { apiClient } from "@/services/api-client";
import type { Customer, DniLookupResponse } from "@/types/api";

export type CustomerCreateRequest = {
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
};

export type CustomerUpdateRequest = Partial<CustomerCreateRequest> & {
  is_active?: boolean;
};

export type CustomerResolveDniResponse = {
  customer: Customer;
  source: "LOCAL_DB" | "APIPERU_CREATED" | string;
};

export function isValidDni(value: string): boolean {
  return /^\d{8}$/.test(value.trim());
}

export function isValidPeruvianPhone(value: string): boolean {
  return /^\d{9}$/.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const customerService = {
  lookupDni(dni: string, token: string): Promise<DniLookupResponse> {
    if (!isValidDni(dni)) {
      return Promise.reject(new Error("El DNI debe tener exactamente 8 dígitos."));
    }

    return apiClient.get<DniLookupResponse>(`/document-lookup/dni/${dni}`, {
      token,
    });
  },

  listCustomers(token: string): Promise<Customer[]> {
    return apiClient.get<Customer[]>("/customers", {
      token,
    });
  },

  getCustomerByDocument(
    documentType: string,
    documentNumber: string,
    token: string,
  ): Promise<Customer> {
    return apiClient.get<Customer>(
      `/customers/by-document/${documentType}/${documentNumber}`,
      {
        token,
      },
    );
  },

  createCustomer(
    payload: CustomerCreateRequest,
    token: string,
  ): Promise<Customer> {
    return apiClient.post<Customer, CustomerCreateRequest>(
      "/customers",
      payload,
      {
        token,
      },
    );
  },

  resolveDni(dni: string, token: string): Promise<CustomerResolveDniResponse> {
    if (!isValidDni(dni)) {
      return Promise.reject(new Error("El DNI debe tener exactamente 8 dígitos."));
    }

    return apiClient.post<CustomerResolveDniResponse, Record<string, never>>(
      `/customers/resolve-dni/${dni}`,
      {},
      {
        token,
      },
    );
  },

  updateCustomer(
    customerId: string,
    payload: CustomerUpdateRequest,
    token: string,
  ): Promise<Customer> {
    return apiClient.patch<Customer, CustomerUpdateRequest>(
      `/customers/${customerId}`,
      payload,
      {
        token,
      },
    );
  },
};
