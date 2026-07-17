"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/use-auth";
import { returnService } from "@/features/returns/return-service";
import { saleService } from "@/features/sales/sale-service";
import { ApiClientError } from "@/services/api-client";
import type { ReturnTransaction, Sale } from "@/types/api";

function money(value: string | number) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value));
}

function customerName(sale?: Sale) {
  if (!sale?.customer) return "Público general";
  return `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim();
}

const resolutionLabels: Record<string, string> = {
  RESTOCK: "Reintegrado a stock",
  DEFECTIVE: "Defectuoso",
  REVIEW: "En revisión",
  DAMAGE: "Merma",
  SUPPLIER_RETURN: "Devuelto al proveedor",
};

export default function ReturnsHistoryPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<ReturnTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function cancelPending(transactionId: string) {
    if (!token) return;
    try {
      setCancellingId(transactionId);
      await returnService.cancel(transactionId, token);
      toast.success("Cambio pendiente cancelado y reserva liberada.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "No se pudo cancelar el cambio.");
    } finally {
      setCancellingId(null);
    }
  }

  const salesById = useMemo(() => new Map(sales.map((sale) => [sale.id, sale])), [sales]);
  const filteredTransactions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const sale = salesById.get(transaction.original_sale_id);
      const matchesType = typeFilter === "ALL" || transaction.transaction_type === typeFilter;
      const matchesSearch = !search || [transaction.return_number, sale?.sale_number, customerName(sale), sale?.customer?.document_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesType && matchesSearch;
    });
  }, [salesById, searchTerm, transactions, typeFilter]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [returnsResponse, salesResponse] = await Promise.all([
        returnService.list(token),
        saleService.listSales(token),
      ]);
      setTransactions(returnsResponse);
      setSales(salesResponse);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "No se pudo cargar el historial.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  return (
    <AppShell title="Historial de cambios y devoluciones" description="Consulta las operaciones realizadas y su impacto económico e inventario.">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link className={buttonVariants({ variant: "outline" })} href="/returns"><ArrowLeft className="h-4 w-4" />Nueva operación</Link>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" />Operaciones registradas</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_13rem]">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Operación, venta, cliente o DNI" /></div>
              <select className="h-10 rounded-md border bg-white px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">Todos los tipos</option><option value="EXCHANGE">Cambios</option><option value="RETURN">Devoluciones</option></select>
            </div>
            {isLoading ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando historial...</div> : filteredTransactions.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-sm text-slate-500">No hay operaciones que coincidan con la búsqueda.</p> : <div className="space-y-3">{filteredTransactions.map((transaction) => {
              const sale = salesById.get(transaction.original_sale_id);
              const originalItems = new Map(sale?.items.map((item) => [item.id, item]));
              const difference = Number(transaction.difference_amount);
              return (
                <div className="rounded-lg border bg-white p-4" key={transaction.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{transaction.return_number}</p>
                        <Badge>{transaction.transaction_type === "EXCHANGE" ? "Cambio" : "Devolución"}</Badge>
                        {transaction.status === "PENDING_PAYMENT" ? <Badge variant="outline">Esperando pago en tablet</Badge> : null}
                        {transaction.settlement ? <Badge variant="outline">{transaction.settlement.status === "SETTLED" ? "Liquidado" : transaction.settlement.status}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-700">Venta {sale?.sale_number || "-"} · {customerName(sale)}</p>
                      <p className="mt-1 text-xs text-slate-500">{sale?.customer?.document_number || "Sin documento"} · {new Date(transaction.created_at).toLocaleString("es-PE")}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">{difference > 0 ? "Cobrado al cliente" : difference < 0 ? "Devuelto al cliente" : "Sin diferencia"}</p>
                      <p className="mt-1 text-lg font-bold">{money(transaction.settlement?.amount ?? Math.abs(difference))}</p>
                      <p className="text-xs text-slate-500">{transaction.settlement?.method || transaction.settlement_method || "-"}</p>
                      {transaction.settlement?.operation_reference ? <p className="mt-1 text-xs text-slate-500">Ref. {transaction.settlement.operation_reference}</p> : null}
                      {transaction.status === "PENDING_PAYMENT" ? (
                        <Button
                          className="mt-3"
                          disabled={cancellingId === transaction.id}
                          size="sm"
                          variant="outline"
                          onClick={() => void cancelPending(transaction.id)}
                        >
                          {cancellingId === transaction.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Cancelar cobro
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Productos recibidos</p>
                      {transaction.items.map((item) => {
                        const original = originalItems.get(item.sale_item_id);
                        return <p className="mt-2 text-sm" key={item.id}>{item.quantity} × {original?.product_name || "Producto"} <span className="text-slate-500">{original?.variant_sku}</span></p>;
                      })}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Solución</p>
                      <p className="mt-2 text-sm">{resolutionLabels[transaction.inventory_resolution] || transaction.inventory_resolution}</p>
                      {transaction.replacements.map((item) => <p className="mt-2 text-sm" key={item.id}>{item.quantity} × {item.product_name} <span className="text-slate-500">{item.variant_sku}</span></p>)}
                    </div>
                  </div>
                </div>
              );
            })}</div>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
