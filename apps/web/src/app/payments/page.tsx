"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Printer,
  ReceiptText,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/use-auth";
import { paymentService } from "@/features/payments/payment-service";
import {
  formatPaymentMethod,
  formatPaymentStatus,
  statusBadgeVariant,
} from "@/lib/status-format";
import { ApiClientError } from "@/services/api-client";
import type { Payment, Sale } from "@/types/api";

const paymentFilterMethods = [
  "ALL",
  "CASH",
  "YAPE",
  "PLIN",
  "TRANSFER",
  "POS",
  "CULQI",
] as const;
const paymentStatuses = ["ALL", "PAID", "PENDING", "FAILED", "REFUNDED"] as const;

type PaymentReceipt = {
  payment: Payment;
  sale: Sale;
};

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCustomerName(sale: Sale | undefined) {
  if (!sale?.customer) {
    return "Público general";
  }

  return `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim();
}

function formatItemDescription(item: Sale["items"][number]) {
  return [item.product_name, item.size, item.color].filter(Boolean).join(" | ");
}

export default function PaymentsPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] =
    useState<(typeof paymentFilterMethods)[number]>("ALL");
  const [statusFilter, setStatusFilter] =
    useState<(typeof paymentStatuses)[number]>("ALL");
  const [receiptToPrint, setReceiptToPrint] = useState<PaymentReceipt | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const salesById = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale])),
    [sales],
  );

  const filteredPayments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return payments.filter((payment) => {
      const sale = salesById.get(payment.sale_id);
      const searchableText = [
        payment.payment_method,
        payment.status,
        payment.operation_code,
        payment.amount,
        sale?.sale_number,
        formatCustomerName(sale),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesMethod =
        methodFilter === "ALL" || payment.payment_method === methodFilter;
      const matchesStatus =
        statusFilter === "ALL" || payment.status === statusFilter;

      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [methodFilter, payments, salesById, searchTerm, statusFilter]);

  const paidTotal = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "PAID")
        .reduce((currentTotal, payment) => currentTotal + Number(payment.amount), 0),
    [payments],
  );

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const [salesResponse, paymentsResponse] = await Promise.all([
        paymentService.listSales(token),
        paymentService.listPayments(token),
      ]);

      setSales(salesResponse);
      setPayments(paymentsResponse);

    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cargar la información de pagos.";

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");

      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadData, router]);

  function handlePrintPayment(payment: Payment) {
    const sale = salesById.get(payment.sale_id);

    if (!sale) {
      toast.error("No se encontró la venta asociada al pago.");

      return;
    }

    setReceiptToPrint({ payment, sale });

    window.setTimeout(() => {
      window.print();
    }, 50);
  }

  return (
    <>
      <div className="print:hidden">
        <AppShell
          title="Pagos"
          description="Consulta pagos registrados y reimprime comprobantes."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <PaymentMetric label="Pagos registrados" value={payments.length} />
            <PaymentMetric label="Total pagado" value={formatMoney(paidTotal)} />
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5" />
                    Historial de pagos
                  </CardTitle>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Buscar venta, cliente o código"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={methodFilter}
                    onChange={(event) =>
                      setMethodFilter(
                        event.target.value as typeof methodFilter,
                      )
                    }
                  >
                    {paymentFilterMethods.map((paymentMethod) => (
                      <option key={paymentMethod} value={paymentMethod}>
                        {paymentMethod === "ALL"
                          ? "Método: todos"
                          : formatPaymentMethod(paymentMethod)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as typeof statusFilter,
                      )
                    }
                  >
                    {paymentStatuses.map((paymentStatus) => (
                      <option key={paymentStatus} value={paymentStatus}>
                        {paymentStatus === "ALL"
                          ? "Estado: todos"
                          : formatPaymentStatus(paymentStatus)}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando pagos...
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No hay pagos con esos filtros.
                  </p>
                ) : (
                  <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                    {filteredPayments.map((payment) => {
                      const sale = salesById.get(payment.sale_id);

                      return (
                        <div
                          key={payment.id}
                          className="rounded-lg border bg-white p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {sale?.sale_number ??
                                  payment.sale_id.slice(0, 8)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDateTime(
                                  payment.paid_at ?? payment.created_at,
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={statusBadgeVariant(payment.status)}
                              >
                                {formatPaymentStatus(payment.status)}
                              </Badge>
                              <p className="text-lg font-bold">
                                {formatMoney(payment.amount)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 border-t pt-3 text-sm sm:grid-cols-3">
                            <div>
                              <p className="text-xs text-slate-500">Cliente</p>
                              <p className="mt-1 font-medium">
                                {formatCustomerName(sale)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">
                                Método de pago
                              </p>
                              <p className="mt-1 font-medium">
                                {formatPaymentMethod(payment.payment_method)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">
                                Referencia
                              </p>
                              <p className="mt-1 font-medium">
                                {payment.operation_code || "Sin referencia"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              disabled={payment.status !== "PAID" || !sale}
                              onClick={() => handlePrintPayment(payment)}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Reimprimir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </AppShell>
      </div>

      {receiptToPrint ? (
        <PaymentReceiptPrintView receipt={receiptToPrint} />
      ) : null}
    </>
  );
}

function PaymentMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}

function PaymentReceiptPrintView({ receipt }: { receipt: PaymentReceipt }) {
  const { payment, sale } = receipt;

  return (
    <section className="hidden bg-white p-6 text-slate-950 print:block">
      <div className="mx-auto max-w-[760px]">
        <div className="border-b border-slate-300 pb-4 text-center">
          <p className="text-xl font-bold">Kadosh</p>
          <p className="mt-1 text-sm font-semibold">Comprobante de venta</p>
          <p className="mt-1 text-xs text-slate-600">
            Reimpresión de comprobante interno
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Venta</p>
            <p className="font-semibold">{sale.sale_number}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Fecha</p>
            <p className="font-semibold">
              {formatDateTime(payment.paid_at ?? payment.created_at)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Medio de pago</p>
            <p className="font-semibold">
              {formatPaymentMethod(payment.payment_method)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Operación</p>
            <p className="font-semibold">{payment.operation_code || "-"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm">
          <p className="font-semibold">Cliente: {formatCustomerName(sale)}</p>
          {sale.customer ? (
            <>
              <p className="mt-1 text-slate-600">
                {sale.customer.document_type || "Documento"}:{" "}
                {sale.customer.document_number || "-"}
              </p>
              {sale.customer.phone || sale.customer.email ? (
                <p className="mt-1 text-slate-600">
                  {[sale.customer.phone, sale.customer.email]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2">Producto</th>
              <th className="py-2 text-center">Cant.</th>
              <th className="py-2 text-right">P. unit.</th>
              <th className="py-2 text-right">Desc.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="py-2">
                  <p className="font-medium">{formatItemDescription(item)}</p>
                  <p className="text-xs text-slate-500">SKU: {item.variant_sku}</p>
                </td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">
                  {formatMoney(item.unit_price)}
                </td>
                <td className="py-2 text-right">
                  {formatMoney(item.discount_amount)}
                </td>
                <td className="py-2 text-right font-semibold">
                  {formatMoney(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 w-full max-w-[320px] space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>{formatMoney(sale.discount_total)}</span>
          </div>
          <div className="flex justify-between">
            <span>IGV / impuesto</span>
            <span>{formatMoney(sale.tax_total)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(sale.total)}</span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-300 pt-4 text-center text-xs text-slate-600">
          <p>Pago registrado correctamente.</p>
          <p className="mt-1">Gracias por su compra.</p>
        </div>
      </div>
    </section>
  );
}
