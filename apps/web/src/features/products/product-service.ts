import { apiClient } from "@/services/api-client";
import type { Category, Product } from "@/types/api";

export type ProductCreateRequest = {
  category_id: string;
  name: string;
  description?: string | null;
  brand?: string | null;
};

export type ProductUpdateRequest = Partial<ProductCreateRequest> & {
  status?: string;
  is_active?: boolean;
};

export const productService = {
  listCategories(token: string): Promise<Category[]> {
    return apiClient.get<Category[]>("/categories", {
      token,
    });
  },

  listProducts(token: string): Promise<Product[]> {
    return apiClient.get<Product[]>("/products", {
      token,
    });
  },

  createProduct(
    payload: ProductCreateRequest,
    token: string,
  ): Promise<Product> {
    return apiClient.post<Product, ProductCreateRequest>("/products", payload, {
      token,
    });
  },

  updateProduct(
    productId: string,
    payload: ProductUpdateRequest,
    token: string,
  ): Promise<Product> {
    return apiClient.patch<Product, ProductUpdateRequest>(
      `/products/${productId}`,
      payload,
      {
        token,
      },
    );
  },
};
