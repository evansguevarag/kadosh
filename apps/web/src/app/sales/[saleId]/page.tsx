"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer, ReceiptText, User } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/use-auth";
import { saleService } from "@/features/sales/sale-service";
import { formatSaleStatus, statusBadgeVariant } from "@/lib/status-format";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import type { Sale } from "@/types/api";

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

function formatCustomerName(sale: Sale) {
  if (!sale.customer) {
    return "Público general";
  }

  return `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim();
}

function formatItemDescription(item: Sale["items"][number]) {
  const details = [item.product_name, item.size, item.color]
    .filter(Boolean)
    .join(" | ");

  return details || item.variant_sku;
}

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams<{ saleId: string }>();
  const { token, isAuthenticated } = useAuth();

  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSale = useCallback(async () => {
    if (!token || !params.saleId) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await saleService.getSale(params.saleId, token);
      setSale(response);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cargar el detalle de la venta.";

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [params.saleId, token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");

      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSale();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadSale, router]);

  function handlePrintReceipt() {
    window.print();
  }

  return (
    <>
      <div className="print:hidden">
        <AppShell
          title="Detalle de venta"
          description="Revisa cliente, productos, estado y totales de la operación."
        >
          <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className={cn(buttonVariants({ variant: "outline" }))}
            href="/sales"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {sale ? (
              <Badge variant={statusBadgeVariant(sale.status)}>
                {formatSaleStatus(sale.status)}
              </Badge>
            ) : null}

            <Button
              type="button"
              disabled={!sale}
              onClick={handlePrintReceipt}
            >
              <Printer className="h-4 w-4" />
              Imprimir comprobante
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle...
            </CardContent>
          </Card>
        ) : sale ? (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ReceiptText className="h-5 w-5" />
                    Venta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <InfoRow label="Número" value={sale.sale_number} />
                  <InfoRow label="Creada" value={formatDateTime(sale.created_at)} />
                  <InfoRow label="Pagada" value={formatDateTime(sale.paid_at)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-5 w-5" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <InfoRow label="Nombre" value={formatCustomerName(sale)} />
                  <InfoRow
                    label="Documento"
                    value={
                      sale.customer?.document_number
                        ? `${sale.customer.document_type} ${sale.customer.document_number}`
                        : "-"
                    }
                  />
                  <InfoRow label="Correo" value={sale.customer?.email || "-"} />
                  <InfoRow label="Teléfono" value={sale.customer?.phone || "-"} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Totales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <InfoRow label="Subtotal" value={formatMoney(sale.subtotal)} />
                  <InfoRow
                    label="Descuento"
                    value={formatMoney(sale.discount_total)}
                  />
                  <InfoRow label="IGV" value={formatMoney(sale.tax_total)} />
                  <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
                    <span>Total</span>
                    <span>{formatMoney(sale.total)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Productos vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:hidden">
                  {sale.items.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {item.product_name}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {item.variant_sku} · {item.size || "-"} ·{" "}
                            {item.color || "-"}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold">
                          {formatMoney(item.subtotal)}
                        </p>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                        <div>
                          <dt className="text-xs text-slate-500">Cantidad</dt>
                          <dd className="mt-1 font-semibold">{item.quantity}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Precio</dt>
                          <dd className="mt-1 font-semibold">
                            {formatMoney(item.unit_price)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Descuento</dt>
                          <dd className="mt-1 font-semibold">
                            {formatMoney(item.discount_amount)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Cant.</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Descuento</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {sale.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-slate-500">
                                {item.size || "-"} | {item.color || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{item.variant_sku}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatMoney(item.unit_price)}</TableCell>
                          <TableCell>
                            {formatMoney(item.discount_amount)}
                          </TableCell>
                          <TableCell>{formatMoney(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500">
              No se encontró la venta solicitada.
            </CardContent>
          </Card>
        )}
          </div>
        </AppShell>
      </div>

      {sale ? <SaleReceiptPrintView sale={sale} /> : null}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SaleReceiptPrintView({ sale }: { sale: Sale }) {
  return (
    <section className="hidden bg-white p-6 text-slate-950 print:block">
      <div className="mx-auto max-w-[760px]">
        <div className="border-b border-slate-300 pb-4 text-center">
          <p className="text-xl font-bold">Kadosh</p>
          <p className="mt-1 text-sm font-semibold">Comprobante de venta</p>
          <p className="mt-1 text-xs text-slate-600">
            Comprobante interno de compra
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
              {formatDateTime(sale.paid_at || sale.created_at)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Estado</p>
            <p className="font-semibold">{formatSaleStatus(sale.status)}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Artículos</p>
            <p className="font-semibold">{sale.items.length}</p>
          </div>
        </div>

        {sale.customer ? (
          <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm">
            <p className="font-semibold">
              Cliente: {sale.customer.first_name} {sale.customer.last_name || ""}
            </p>
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
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm">
            <p className="font-semibold">Cliente: Público general</p>
          </div>
        )}

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
                  <p className="text-xs text-slate-500">
                    SKU: {item.variant_sku}
                  </p>
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
          <p>Venta procesada correctamente.</p>
          <p className="mt-1">Gracias por su compra.</p>
        </div>
      </div>
    </section>
  );
}
