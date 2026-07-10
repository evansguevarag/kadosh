"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Loader2,
  MonitorSmartphone,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/use-auth";
import { paymentService } from "@/features/payments/payment-service";
import type { CustomerDisplayDevice } from "@/features/payments/customer-display-device-service";
import { reportService } from "@/features/reports/report-service";
import { saleService } from "@/features/sales/sale-service";
import { formatPaymentMethod, formatSaleStatus } from "@/lib/status-format";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import type { Payment, ReportsDashboard, Sale } from "@/types/api";

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function isToday(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatCustomerName(sale: Sale) {
  if (!sale.customer) {
    return "Público general";
  }

  return `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim();
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [devices, setDevices] = useState<CustomerDisplayDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeDevices = useMemo(
    () => devices.filter((device) => device.is_active),
    [devices],
  );

  const pendingSales = useMemo(
    () =>
      sales.filter(
        (sale) => sale.status !== "PAID" && sale.status !== "CANCELLED",
      ),
    [sales],
  );

  const paidSalesToday = useMemo(
    () =>
      sales.filter(
        (sale) =>
          sale.status === "PAID" && isToday(sale.paid_at ?? sale.created_at),
      ),
    [sales],
  );

  const paidRevenueToday = useMemo(
    () =>
      paidSalesToday.reduce(
        (currentTotal, sale) => currentTotal + Number(sale.total),
        0,
      ),
    [paidSalesToday],
  );

  const averageTicketToday = useMemo(() => {
    if (paidSalesToday.length === 0) {
      return 0;
    }

    return paidRevenueToday / paidSalesToday.length;
  }, [paidRevenueToday, paidSalesToday.length]);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const [dashboardResponse, salesResponse, devicesResponse, paymentsResponse] =
        await Promise.all([
          reportService.getDashboard(token),
          saleService.listSales(token),
          saleService.listCustomerDisplayDevices(token),
          paymentService.listPayments(token),
        ]);

      setDashboard(dashboardResponse);
      setSales(salesResponse);
      setDevices(devicesResponse);
      setPayments(paymentsResponse);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cargar el dashboard.";

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
      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadDashboard, router]);

  return (
    <AppShell
      title="Panel principal"
      description="Vista operativa para ventas, caja, stock y tablets."
    >
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando indicadores...
          </CardContent>
        </Card>
      ) : !dashboard ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            No se pudo cargar la información del dashboard.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Ingresos hoy
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-slate-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatMoney(paidRevenueToday)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {paidSalesToday.length} venta
                  {paidSalesToday.length === 1 ? "" : "s"} pagada
                  {paidSalesToday.length === 1 ? "" : "s"} hoy
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Ingresos pagados
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-slate-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatMoney(dashboard.sales_summary.total_revenue)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Histórico pagado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Ventas pagadas
                </CardTitle>
                <ReceiptText className="h-5 w-5 text-slate-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {dashboard.sales_summary.paid_sales}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ticket hoy {formatMoney(averageTicketToday)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Pendientes de cobro
                </CardTitle>
                <CreditCard className="h-5 w-5 text-slate-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{pendingSales.length}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ventas que todavía necesitan pago
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Tablets activas
                </CardTitle>
                <MonitorSmartphone className="h-5 w-5 text-slate-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{activeDevices.length}</p>
                <p className="mt-1 text-xs text-slate-500">
                  De {devices.length} pantallas vinculadas
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Ventas recientes
                </CardTitle>
                <Link
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  href="/sales"
                >
                    Ver ventas
                    <ArrowRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent>
                {sales.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Todavía no hay ventas registradas.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Venta</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sales.slice(0, 8).map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">
                              {sale.sale_number}
                            </TableCell>
                            <TableCell>
                              {formatCustomerName(sale)}
                            </TableCell>
                            <TableCell>{formatMoney(sale.total)}</TableCell>
                            <TableCell>{formatSaleStatus(sale.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Últimos pagos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Todavía no hay pagos registrados.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {payments.slice(0, 5).map((payment) => {
                        const sale = sales.find(
                          (currentSale) => currentSale.id === payment.sale_id,
                        );

                        return (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3"
                          >
                            <div>
                              <p className="font-medium">
                                {sale?.sale_number ?? payment.sale_id.slice(0, 8)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatPaymentMethod(payment.payment_method)} ·{" "}
                                {sale ? formatCustomerName(sale) : "Venta"}
                              </p>
                            </div>
                            <p className="font-semibold">
                              {formatMoney(payment.amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Bajo stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.low_stock_products.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No hay productos con bajo stock.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.low_stock_products.slice(0, 5).map((product) => (
                        <div
                          key={product.product_variant_id}
                          className="rounded-xl border bg-slate-50 p-3"
                        >
                          <p className="font-medium">{product.product_name}</p>
                          <p className="text-xs text-slate-500">
                            {product.sku} | Stock {product.stock_quantity} |
                            Mín. {product.min_stock_quantity}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PackageSearch className="h-5 w-5" />
                    Próximas acciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link
                    className={cn(buttonVariants(), "w-full justify-between")}
                    href="/pos"
                  >
                    Nueva venta
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full justify-between",
                    )}
                    href="/inventory"
                  >
                    Revisar inventario
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full justify-between",
                    )}
                    href="/payments"
                  >
                    Registrar pago manual
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
