import { apiClient } from "@/services/api-client";
import type { Product, ProductVariant } from "@/types/api";

export type ProductVariantCreateRequest = {
  product_id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  cost_price: string;
  sale_price: string;
  stock_quantity: number;
  min_stock_quantity: number;
};

export type ProductVariantUpdateRequest = Partial<ProductVariantCreateRequest> & {
  status?: string;
  is_active?: boolean;
};

export type ProductVariantBarcodeBackfillResponse = {
  updated_count: number;
  variants: ProductVariant[];
};

export const productVariantService = {
  listProducts(token: string): Promise<Product[]> {
    return apiClient.get<Product[]>("/products", {
      token,
    });
  },

  listVariants(token: string): Promise<ProductVariant[]> {
    return apiClient.get<ProductVariant[]>("/product-variants", {
      token,
    });
  },

  listVariantsByProduct(
    productId: string,
    token: string,
  ): Promise<ProductVariant[]> {
    return apiClient.get<ProductVariant[]>(
      `/product-variants/by-product/${productId}`,
      {
        token,
      },
    );
  },

  getVariantByCode(code: string, token: string): Promise<ProductVariant> {
    return apiClient.get<ProductVariant>(
      `/product-variants/by-code/${encodeURIComponent(code)}`,
      {
        token,
      },
    );
  },

  createVariant(
    payload: ProductVariantCreateRequest,
    token: string,
  ): Promise<ProductVariant> {
    return apiClient.post<ProductVariant, ProductVariantCreateRequest>(
      "/product-variants",
      payload,
      {
        token,
      },
    );
  },

  updateVariant(
    variantId: string,
    payload: ProductVariantUpdateRequest,
    token: string,
  ): Promise<ProductVariant> {
    return apiClient.patch<ProductVariant, ProductVariantUpdateRequest>(
      `/product-variants/${variantId}`,
      payload,
      {
        token,
      },
    );
  },

  generateMissingBarcodes(
    token: string,
  ): Promise<ProductVariantBarcodeBackfillResponse> {
    return apiClient.post<
      ProductVariantBarcodeBackfillResponse,
      Record<string, never>
    >("/product-variants/barcodes/generate-missing", {}, {
      token,
    });
  },
};
