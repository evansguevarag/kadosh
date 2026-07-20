import { apiClient } from "@/services/api-client";
import type { ManagedUser, UserRole } from "@/types/api";

export type UserCreateRequest = {
  first_name: string;
  paternal_last_name: string;
  maternal_last_name: string;
  email: string;
  password: string;
  document_number: string;
  phone: string;
  role: UserRole;
};

export type UserUpdateRequest = Partial<UserCreateRequest> & {
  is_active?: boolean;
};

export const userService = {
  list(token: string): Promise<ManagedUser[]> {
    return apiClient.get<ManagedUser[]>("/users", { token });
  },
  create(payload: UserCreateRequest, token: string): Promise<ManagedUser> {
    return apiClient.post<ManagedUser, UserCreateRequest>("/users", payload, { token });
  },
  update(userId: string, payload: UserUpdateRequest, token: string): Promise<ManagedUser> {
    return apiClient.patch<ManagedUser, UserUpdateRequest>(`/users/${userId}`, payload, { token });
  },
};
