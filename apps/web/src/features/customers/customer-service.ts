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

export const customerService = {
  lookupDni(dni: string, token: string): Promise<DniLookupResponse> {
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
