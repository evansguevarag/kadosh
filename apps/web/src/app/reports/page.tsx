"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Loader2,
  PackageSearch,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/use-auth";
import { reportService } from "@/features/reports/report-service";
import {
  formatPaymentMethod,
  formatPaymentStatus,
  formatSaleStatus,
} from "@/lib/status-format";
import { ApiClientError } from "@/services/api-client";
import type { Payment, ReportsDashboard, Sale } from "@/types/api";

type TopProduct = {
  quantity: number;
  revenue: number;
  sku: string;
};

const reportTabs = ["RESUMEN", "VENTAS", "PRODUCTOS", "INVENTARIO"] as const;

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 6);

  return toDateInputValue(date);
}

function escapeCsvValue(value: string | number) {
  const text = String(value).replaceAll('"', '""');

  return `"${text}"`;
}

function getCustomerName(sale: Sale) {
  return sale.customer
    ? `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim()
    : "Cliente general";
}

function getCustomerDocument(sale: Sale) {
  return sale.customer
    ? `${sale.customer.document_type} ${sale.customer.document_number}`
    : "";
}

function getSellerName(sale: Sale) {
  return `${sale.seller.first_name} ${sale.seller.paternal_last_name} ${sale.seller.maternal_last_name}`.trim();
}

export default function ReportsPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [activeTab, setActiveTab] =
    useState<(typeof reportTabs)[number]>("RESUMEN");
  const [sellerFilter, setSellerFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  const sellers = useMemo(() => {
    const unique = new Map<string, string>();
    sales.forEach((sale) => unique.set(sale.seller.id, getSellerName(sale)));
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sales]);
  const filteredSales = useMemo(
    () => sales.filter((sale) => sellerFilter === "ALL" || sale.seller.id === sellerFilter),
    [sales, sellerFilter],
  );
  const filteredPayments = useMemo(() => {
    const saleIds = new Set(filteredSales.map((sale) => sale.id));
    return payments.filter((payment) => saleIds.has(payment.sale_id));
  }, [filteredSales, payments]);

  const paidSales = useMemo(
    () => filteredSales.filter((sale) => sale.status === "PAID"),
    [filteredSales],
  );

  const revenue = useMemo(
    () =>
      paidSales.reduce(
        (currentTotal, sale) => currentTotal + Number(sale.total),
        0,
      ),
    [paidSales],
  );

  const averageTicket = useMemo(() => {
    if (paidSales.length === 0) {
      return 0;
    }

    return revenue / paidSales.length;
  }, [paidSales.length, revenue]);

  const totalCost = useMemo(
    () => paidSales.reduce(
      (saleTotal, sale) => saleTotal + sale.items.reduce(
        (itemTotal, item) => itemTotal + Number(item.cost_price) * item.quantity,
        0,
      ),
      0,
    ),
    [paidSales],
  );
  const grossProfit = revenue - totalCost;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const revenueByMethod = useMemo(() => {
    const totals = new Map<string, number>();

    for (const payment of filteredPayments) {
      if (payment.status !== "PAID") {
        continue;
      }

      totals.set(
        payment.payment_method,
        (totals.get(payment.payment_method) ?? 0) + Number(payment.amount),
      );
    }

    return Array.from(totals.entries())
      .map(([method, total]) => ({ method, total }))
      .sort((first, second) => second.total - first.total);
  }, [filteredPayments]);

  const topProducts = useMemo(() => {
    const products = new Map<string, TopProduct>();

    for (const sale of paidSales) {
      for (const item of sale.items) {
        const currentProduct = products.get(item.variant_sku) ?? {
          quantity: 0,
          revenue: 0,
          sku: item.variant_sku,
        };

        currentProduct.quantity += item.quantity;
        currentProduct.revenue += Number(item.subtotal);
        products.set(item.variant_sku, currentProduct);
      }
    }

    return Array.from(products.values()).sort(
      (first, second) => second.quantity - first.quantity,
    );
  }, [paidSales]);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await reportService.getDetail(startDate, endDate, token);

      setDashboard(response.dashboard);
      setSales(response.sales);
      setPayments(response.payments);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron cargar los reportes.";

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [endDate, startDate, token]);

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

  function setQuickRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
  }

  function handleExportExcel() {
    if (!dashboard) {
      toast.error("No hay datos cargados para exportar.");

      return;
    }

    const saleById = new Map(filteredSales.map((sale) => [sale.id, sale]));
    const rows: (string | number)[][] = [
      ["REPORTE DETALLADO KADOSH"],
      ["Periodo", `${startDate} al ${endDate}`],
      ["Generado", new Date().toLocaleString("es-PE")],
      [],
      ["RESUMEN"],
      ["Indicador", "Valor"],
      ["Ventas registradas", filteredSales.length],
      ["Ventas pagadas", paidSales.length],
      ["Ventas canceladas", dashboard.sales_summary.cancelled_sales],
      ["Ingresos cobrados", revenue.toFixed(2)],
      ["Ticket promedio", averageTicket.toFixed(2)],
      ["Productos con bajo stock", dashboard.low_stock_products.length],
      [],
      ["INGRESOS POR METODO DE PAGO"],
      ["Metodo", "Importe"],
      ...(
        revenueByMethod.length > 0
          ? revenueByMethod.map((method) => [
              formatPaymentMethod(method.method),
              method.total.toFixed(2),
            ])
          : [["Sin pagos en el periodo", ""]]
      ),
      [],
      ["PAGOS DETALLADOS"],
      [
        "Fecha pago",
        "Fecha registro",
        "Venta",
        "Cliente",
        "Documento",
        "Metodo",
        "Proveedor",
        "Estado",
        "Monto",
        "Moneda",
        "Codigo referencia",
        "Orden proveedor",
        "Transaccion proveedor",
        "Culqi charge",
      ],
      ...(
        filteredPayments.length > 0
          ? filteredPayments.map((payment) => {
              const sale = saleById.get(payment.sale_id);

              return [
                payment.paid_at
                  ? new Date(payment.paid_at).toLocaleString("es-PE")
                  : "",
                new Date(payment.created_at).toLocaleString("es-PE"),
                sale?.sale_number ?? payment.sale_id,
                sale ? getCustomerName(sale) : "",
                sale ? getCustomerDocument(sale) : "",
                formatPaymentMethod(payment.payment_method),
                payment.provider ?? "",
                formatPaymentStatus(payment.status),
                payment.amount,
                payment.currency,
                payment.operation_code ?? "",
                payment.provider_order_id ?? "",
                payment.provider_transaction_id ?? "",
                payment.culqi_charge_id ?? "",
              ];
            })
          : [["Sin pagos en el periodo", "", "", "", "", "", "", "", "", "", "", "", "", ""]]
      ),
      [],
      ["VENTAS DETALLADAS POR ARTICULO"],
      [
        "Fecha",
        "Venta",
        "Estado",
        "Cliente",
        "Documento",
        "Correo",
        "Telefono",
        "SKU",
        "Producto",
        "Talla",
        "Color",
        "Cantidad",
        "Precio unitario",
        "Descuento articulo",
        "Subtotal",
        "Subtotal venta",
        "Descuento venta",
        "Impuesto",
        "Total venta",
        "Fecha pago",
        "Fecha cancelacion",
        "Notas",
      ],
      ...(
        filteredSales.length > 0
          ? filteredSales.flatMap((sale) =>
              sale.items.map((item) => [
                new Date(sale.created_at).toLocaleString("es-PE"),
                sale.sale_number,
                formatSaleStatus(sale.status),
                getCustomerName(sale),
                getCustomerDocument(sale),
                sale.customer?.email ?? "",
                sale.customer?.phone ?? "",
                item.variant_sku,
                item.product_name,
                item.size ?? "",
                item.color ?? "",
                item.quantity,
                item.unit_price,
                item.discount_amount,
                item.subtotal,
                sale.subtotal,
                sale.discount_total,
                sale.tax_total,
                sale.total,
                sale.paid_at
                  ? new Date(sale.paid_at).toLocaleString("es-PE")
                  : "",
                sale.cancelled_at
                  ? new Date(sale.cancelled_at).toLocaleString("es-PE")
                  : "",
                sale.notes ?? "",
              ]),
            )
          : [["Sin ventas en el periodo"]]
      ),
      [],
      ["PRODUCTOS VENDIDOS AGRUPADOS"],
      ["Posicion", "SKU", "Cantidad vendida", "Importe"],
      ...(
        topProducts.length > 0
          ? topProducts.map((product, index) => [
              index + 1,
              product.sku,
              product.quantity,
              product.revenue.toFixed(2),
            ])
          : [["Sin productos vendidos", "", "", ""]]
      ),
      [],
      ["PRODUCTOS CON BAJO STOCK"],
      ["SKU", "Producto", "Talla", "Color", "Stock", "Stock minimo", "Faltante"],
      ...(
        dashboard.low_stock_products.length > 0
          ? dashboard.low_stock_products.map((product) => [
              product.sku,
              product.product_name,
              product.size ?? "",
              product.color ?? "",
              product.stock_quantity,
              product.min_stock_quantity,
              Math.max(product.min_stock_quantity - product.stock_quantity, 0),
            ])
          : [["Sin alertas de stock", "", "", "", "", "", ""]]
      ),
    ];

    const csv = rows
      .map((row) => row.map(escapeCsvValue).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-detallado-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte detallado compatible con Excel descargado.");
  }

  return (
    <>
      <div className="print:hidden">
        <AppShell
          title="Reportes"
          description="Analiza ventas, métodos de pago, ticket promedio y stock bajo."
        >
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando reportes...
          </CardContent>
        </Card>
      ) : !dashboard ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            No se pudo cargar la información del reporte.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="print:hidden">
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="startDate">Desde</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellerFilter">Responsable</Label>
                <select
                  id="sellerFilter"
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={sellerFilter}
                  onChange={(event) => setSellerFilter(event.target.value)}
                >
                  <option value="ALL">Todos los responsables</option>
                  {sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Hasta</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <Button type="button" variant="outline" onClick={() => setQuickRange(1)}>
                  Hoy
                </Button>
                <Button type="button" variant="outline" onClick={() => setQuickRange(7)}>
                  7 días
                </Button>
                <Button type="button" variant="outline" onClick={() => setQuickRange(30)}>
                  30 días
                </Button>
                <Button type="button" variant="outline" onClick={handleExportExcel}>
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-1 border-b print:hidden">
            {reportTabs.map((tab) => (
              <Button
                key={tab}
                type="button"
                variant={activeTab === tab ? "default" : "ghost"}
                className="rounded-b-none"
                onClick={() => setActiveTab(tab)}
              >
                {tab === "RESUMEN"
                  ? "Resumen"
                  : tab === "VENTAS"
                    ? "Ventas y caja"
                    : tab === "PRODUCTOS"
                      ? "Productos"
                      : "Inventario"}
              </Button>
            ))}
          </div>

          {activeTab === "RESUMEN" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ReportMetric
                  icon={ReceiptText}
                  label="Ventas pagadas"
                  note={`${filteredSales.length} ventas registradas`}
                  value={paidSales.length}
                />
                <ReportMetric
                  icon={TrendingUp}
                  label="Ingresos"
                  note="Cobrado en el rango"
                  value={formatMoney(revenue)}
                />
                <ReportMetric
                  icon={BarChart3}
                  label="Ticket promedio"
                  note="Solo ventas pagadas"
                  value={formatMoney(averageTicket)}
                />
                <ReportMetric
                  icon={PackageSearch}
                  label="Bajo stock"
                  note="Inventario actual"
                  value={dashboard.low_stock_products.length}
                />
                <ReportMetric
                  icon={TrendingUp}
                  label="Utilidad bruta"
                  note={`Margen ${grossMargin.toFixed(1)}%`}
                  value={formatMoney(grossProfit)}
                />
                <ReportMetric
                  icon={PackageSearch}
                  label="Costo vendido"
                  note="Costo histórico de ventas pagadas"
                  value={formatMoney(totalCost)}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ingresos por método de pago</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueByMethod.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No hay pagos en el rango seleccionado.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {revenueByMethod.map((method) => (
                        <div
                          key={method.method}
                          className="flex items-center justify-between rounded-lg border bg-slate-50 p-3"
                        >
                          <span className="font-medium">
                            {formatPaymentMethod(method.method)}
                          </span>
                          <span className="font-semibold">
                            {formatMoney(method.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeTab === "VENTAS" ? (
            <Card>
              <CardHeader>
                <CardTitle>Ventas del periodo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:hidden">
                  {filteredSales.map((sale) => {
                    const itemCount = sale.items.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    );

                    return (
                      <div key={sale.id} className="rounded-lg border bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {sale.sale_number}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(sale.created_at).toLocaleString("es-PE")}
                            </p>
                          </div>
                          <p className="shrink-0 text-lg font-bold">
                            {formatMoney(sale.total)}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {sale.customer
                                ? `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim()
                                : "Cliente general"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {itemCount} producto{itemCount === 1 ? "" : "s"}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              Atendido por {getSellerName(sale)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-600">
                            {formatSaleStatus(sale.status)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden max-h-[560px] overflow-auto rounded-lg border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Venta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Productos</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {new Date(sale.created_at).toLocaleString("es-PE")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {sale.sale_number}
                          </TableCell>
                          <TableCell>
                            {sale.customer
                              ? `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim()
                              : "Cliente general"}
                          </TableCell>
                          <TableCell>{getSellerName(sale)}</TableCell>
                          <TableCell>
                            {sale.items.reduce(
                              (total, item) => total + item.quantity,
                              0,
                            )}
                          </TableCell>
                          <TableCell>{formatMoney(sale.total)}</TableCell>
                          <TableCell>{formatSaleStatus(sale.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "PRODUCTOS" ? (
            <Card>
              <CardHeader>
                <CardTitle>Productos más vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No hay productos vendidos en el rango seleccionado.
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {topProducts.map((product, index) => (
                        <div
                          key={product.sku}
                          className="flex items-center gap-3 rounded-lg border bg-white p-3"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{product.sku}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {product.quantity} unidades
                            </p>
                          </div>
                          <p className="shrink-0 font-bold">
                            {formatMoney(product.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="hidden max-h-[560px] overflow-auto rounded-lg border md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Posición</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.map((product, index) => (
                          <TableRow key={product.sku}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {product.sku}
                            </TableCell>
                            <TableCell>{product.quantity}</TableCell>
                            <TableCell>{formatMoney(product.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "INVENTARIO" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Productos con bajo stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.low_stock_products.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No hay productos con bajo stock.
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {dashboard.low_stock_products.map((product) => (
                        <div
                          key={product.product_variant_id}
                          className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {product.product_name}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {product.sku}
                              </p>
                            </div>
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-amber-200 pt-3 text-sm">
                            <span className="text-slate-600">Stock / mínimo</span>
                            <span className="text-lg font-bold text-amber-800">
                              {product.stock_quantity} / {product.min_stock_quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden max-h-[560px] overflow-auto rounded-lg border md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Mínimo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.low_stock_products.map((product) => (
                          <TableRow key={product.product_variant_id}>
                            <TableCell className="font-medium">
                              {product.sku}
                            </TableCell>
                            <TableCell>{product.product_name}</TableCell>
                            <TableCell>{product.stock_quantity}</TableCell>
                            <TableCell>{product.min_stock_quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
        </AppShell>
      </div>

      {dashboard ? (
        <ReportsPrintView
          averageTicket={averageTicket}
          dashboard={dashboard}
          endDate={endDate}
          paidSales={paidSales}
          revenue={revenue}
          revenueByMethod={revenueByMethod}
          sales={filteredSales}
          startDate={startDate}
          topProducts={topProducts}
        />
      ) : null}
    </>
  );
}

function ReportMetric({
  icon: Icon,
  label,
  note,
  value,
}: {
  icon: typeof ReceiptText;
  label: string;
  note: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-slate-500">
          {label}
        </CardTitle>
        <Icon className="h-5 w-5 text-slate-500" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{note}</p>
      </CardContent>
    </Card>
  );
}

function ReportsPrintView({
  averageTicket,
  dashboard,
  endDate,
  paidSales,
  revenue,
  revenueByMethod,
  sales,
  startDate,
  topProducts,
}: {
  averageTicket: number;
  dashboard: ReportsDashboard;
  endDate: string;
  paidSales: Sale[];
  revenue: number;
  revenueByMethod: { method: string; total: number }[];
  sales: Sale[];
  startDate: string;
  topProducts: TopProduct[];
}) {
  return (
    <section className="hidden bg-white text-slate-950 print:block">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .report-table { width: 100%; border-collapse: collapse; }
          .report-table th, .report-table td {
            border-bottom: 1px solid #cbd5e1;
            padding: 6px 5px;
            text-align: left;
            vertical-align: top;
          }
          .report-table th { background: #f1f5f9; font-weight: 700; }
          .report-table .text-right { text-align: right; }
          .report-table thead { display: table-header-group; }
          .report-table tr { break-inside: avoid; }
          .report-section { break-inside: avoid; }
          .report-page { break-before: page; }
        }
      `}</style>

      <div className="mx-auto text-[10px] leading-4">
        <header className="flex items-end justify-between border-b-2 border-slate-950 pb-4">
          <div>
            <p className="text-lg font-bold">Kadosh</p>
            <h1 className="mt-1 text-2xl font-bold">Reporte de gestión</h1>
            <p className="mt-1 text-slate-600">
              Periodo: {startDate} al {endDate}
            </p>
          </div>
          <div className="text-right text-slate-600">
            <p>Generado</p>
            <p className="font-semibold text-slate-950">
              {new Date().toLocaleString("es-PE")}
            </p>
          </div>
        </header>

        <section className="report-section mt-5">
          <h2 className="text-sm font-bold">Resumen del periodo</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <PrintMetric label="Ventas pagadas" value={paidSales.length} />
            <PrintMetric label="Ingresos" value={formatMoney(revenue)} />
            <PrintMetric
              label="Ticket promedio"
              value={formatMoney(averageTicket)}
            />
            <PrintMetric
              label="Bajo stock"
              value={dashboard.low_stock_products.length}
            />
          </div>
        </section>

        <section className="report-section mt-5">
          <h2 className="text-sm font-bold">Ingresos por método de pago</h2>
          <table className="report-table mt-2">
            <thead>
              <tr>
                <th>Método</th>
                <th className="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {revenueByMethod.length === 0 ? (
                <tr>
                  <td colSpan={2}>Sin pagos en el periodo.</td>
                </tr>
              ) : (
                revenueByMethod.map((method) => (
                  <tr key={method.method}>
                    <td>{formatPaymentMethod(method.method)}</td>
                    <td className="text-right">{formatMoney(method.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="report-page pt-1">
          <h2 className="text-sm font-bold">Detalle de ventas</h2>
          <table className="report-table mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Venta</th>
                <th>Cliente</th>
                <th>Artículos</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin ventas en el periodo.</td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.created_at).toLocaleString("es-PE")}</td>
                    <td>{sale.sale_number}</td>
                    <td>
                      {sale.customer
                        ? `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim()
                        : "Cliente general"}
                    </td>
                    <td>
                      {sale.items.reduce(
                        (total, item) => total + item.quantity,
                        0,
                      )}
                    </td>
                    <td>{formatMoney(sale.total)}</td>
                    <td>{formatSaleStatus(sale.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="report-page pt-1">
          <h2 className="text-sm font-bold">Productos vendidos</h2>
          <table className="report-table mt-2">
            <thead>
              <tr>
                <th>Posición</th>
                <th>SKU</th>
                <th>Cantidad</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sin productos vendidos en el periodo.</td>
                </tr>
              ) : (
                topProducts.map((product, index) => (
                  <tr key={product.sku}>
                    <td>{index + 1}</td>
                    <td>{product.sku}</td>
                    <td>{product.quantity}</td>
                    <td>{formatMoney(product.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <h2 className="mt-6 text-sm font-bold">Productos con bajo stock</h2>
          <table className="report-table mt-2">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Stock</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.low_stock_products.length === 0 ? (
                <tr>
                  <td colSpan={4}>No hay alertas de stock.</td>
                </tr>
              ) : (
                dashboard.low_stock_products.map((product) => (
                  <tr key={product.product_variant_id}>
                    <td>{product.sku}</td>
                    <td>{product.product_name}</td>
                    <td>{product.stock_quantity}</td>
                    <td>{product.min_stock_quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

function PrintMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-slate-300 p-3">
      <p className="text-slate-600">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}
