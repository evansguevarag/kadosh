import { apiClient } from "@/services/api-client";
import type { ProductVariant } from "@/types/api";

export type InventoryMovement = {
  id: string;
  product_variant_id: string;
  user_id: string | null;
  sale_id: string | null;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  created_at: string;
};

export type InventoryMovementCreateRequest = {
  product_variant_id: string;
  movement_type: string;
  quantity: number;
  reason?: string | null;
};

export const inventoryService = {
  listVariants(token: string): Promise<ProductVariant[]> {
    return apiClient.get<ProductVariant[]>("/product-variants", {
      token,
    });
  },

  listMovements(token: string): Promise<InventoryMovement[]> {
    return apiClient.get<InventoryMovement[]>("/inventory/movements", {
      token,
    });
  },

  createMovement(
    payload: InventoryMovementCreateRequest,
    token: string,
  ): Promise<InventoryMovement> {
    return apiClient.post<
      InventoryMovement,
      InventoryMovementCreateRequest
    >("/inventory/movements", payload, {
      token,
    });
  },
};
