export type UserRole = "ADMIN" | "EMPLOYEE";

export type AuthUser = {
  id: string;
  first_name: string;
  paternal_last_name: string;
  maternal_last_name: string;
  full_name?: string;
  email: string;
  role: UserRole | string;
  role_name?: string;
  status: string;
};

export type ManagedUser = {
  id: string;
  first_name: string;
  paternal_last_name: string;
  maternal_last_name: string;
  email: string;
  document_number: string;
  phone: string;
  role: UserRole;
  status: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: AuthUser;
};

export type PasswordResetRequest = {
  email: string;
};

export type PasswordResetVerifyRequest = {
  email: string;
  otp_code: string;
};

export type PasswordResetConfirmRequest = PasswordResetVerifyRequest & {
  new_password: string;
};

export type PasswordResetResponse = {
  message: string;
  email_delivery_configured: boolean;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ManagedCategory = Category & {
  product_count: number;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  brand: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  cost_price: string;
  sale_price: string;
  stock_quantity: number;
  min_stock_quantity: number;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DniLookupResponse = {
  dni: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  full_name: string;
  source: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_variant_id: string;
  product_name: string;
  variant_sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: string;
  cost_price: string;
  discount_amount: string;
  subtotal: string;
};

export type Sale = {
  id: string;
  sale_number: string;
  receipt_token: string;
  seller_id: string;
  customer_id: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  status: string;
  notes: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: SaleItem[];
  customer: Customer | null;
  seller: {
    id: string;
    first_name: string;
    paternal_last_name: string;
    maternal_last_name: string;
  };
};

export type ReturnTransaction = {
  id: string;
  return_number: string;
  original_sale_id: string;
  processed_by_id: string;
  transaction_type: "RETURN" | "EXCHANGE";
  reason: string;
  item_condition: string;
  inventory_resolution: string;
  returned_value: string;
  replacement_value: string;
  difference_amount: string;
  settlement_method: string | null;
  settlement: {
    id: string;
    direction: "CHARGE" | "REFUND" | "NONE";
    method: string | null;
    amount: string;
    currency: string;
    status: "SETTLED" | "PENDING" | "FAILED" | "CANCELLED";
    operation_reference: string | null;
    settled_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    sale_item_id: string;
    quantity: number;
    unit_value: string;
    subtotal: string;
  }>;
  replacements: Array<{
    id: string;
    product_variant_id: string;
    product_name: string;
    variant_sku: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unit_price: string;
    subtotal: string;
  }>;
};

export type Payment = {
  id: string;
  sale_id: string;
  payment_method: string;
  provider: string | null;
  amount: string;
  currency: string;
  status: string;
  operation_code: string | null;
  provider_order_id: string | null;
  provider_transaction_id: string | null;
  culqi_charge_id: string | null;
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentSession = {
  id: string;
  sale_id: string | null;
  payment_id: string | null;
  seller_id: string;
  device_id: string;
  status: string;
  amount: string;
  currency: string;
  customer_message: string | null;
  receipt_email: string | null;
  expires_at: string;
  viewed_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  context_type?: "SALE" | "RETURN_DIFFERENCE";
  sale?: {
    sale_number: string;
    subtotal: string;
    discount_total: string;
    tax_total: string;
    total: string;
    items: Array<{
      id: string;
      product_name: string;
      variant_sku: string;
      size: string | null;
      color: string | null;
      quantity: number;
      unit_price: string;
      discount_amount: string;
      subtotal: string;
    }>;
  };
  return_difference?: {
    return_number: string;
    original_sale_number: string;
    returned_value: string;
    replacement_value: string;
    difference_amount: string;
    replacements: Array<{
      product_name: string;
      variant_sku: string;
      quantity: number;
    }>;
  };
};

export type SalesSummaryReport = {
  total_sales: number;
  paid_sales: number;
  pending_sales: number;
  cancelled_sales: number;
  total_revenue: string;
  average_ticket: string;
  total_cost: string;
  gross_profit: string;
  gross_margin_percentage: string;
};

export type LowStockProduct = {
  product_variant_id: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  min_stock_quantity: number;
};

export type ReportsDashboard = {
  sales_summary: SalesSummaryReport;
  low_stock_products: LowStockProduct[];
};

export type ReportsDetail = {
  dashboard: ReportsDashboard;
  sales: Sale[];
  payments: Payment[];
};
