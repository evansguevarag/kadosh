export function formatSaleStatus(status: string) {
  const labels: Record<string, string> = {
    CANCELLED: "Cancelada",
    DRAFT: "Borrador",
    PAID: "Pagada",
    PENDING_PAYMENT: "Esperando pago en tablet",
  };

  return labels[status] ?? formatStatus(status);
}

export function formatPaymentStatus(status: string) {
  const labels: Record<string, string> = {
    FAILED: "Fallido",
    PAID: "Pagado",
    PENDING: "Pendiente",
    REFUNDED: "Devuelto",
  };

  return labels[status] ?? formatStatus(status);
}

export function formatStatus(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Activo",
    CANCELLED: "Cancelado",
    CREATED: "Creado",
    CUSTOMER_VIEWING: "Visto por el cliente",
    EXPIRED: "Expirado",
    FAILED: "Fallido",
    INACTIVE: "Inactivo",
    PAID: "Pagado",
    PENDING: "Pendiente",
    PROCESSING: "Procesando",
    REFUNDED: "Devuelto",
    SENT_TO_CUSTOMER: "Enviado al cliente",
  };

  const fallback = status.replaceAll("_", " ").toLowerCase();

  return labels[status] ?? `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)}`;
}

export function formatPaymentMethod(method: string) {
  const labels: Record<string, string> = {
    CASH: "Efectivo",
    CULQI: "Culqi",
    PLIN: "Plin",
    POS: "Terminal POS",
    TRANSFER: "Transferencia",
    YAPE: "Yape",
  };

  return labels[method] ?? method;
}

export function statusBadgeVariant(status: string) {
  if (["PAID", "ACTIVE"].includes(status)) {
    return "default";
  }

  if (["FAILED", "CANCELLED", "INACTIVE"].includes(status)) {
    return "destructive";
  }

  return "outline";
}
