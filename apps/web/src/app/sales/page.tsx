"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, LoadingState } from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const saleStatusFilters = [
  { label: "Todas", value: "ALL" },
  { label: "Pagadas", value: "PAID" },
  { label: "Anuladas", value: "CANCELLED" },
] as const;

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function formatDateTime(value: string) {
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

export default function SalesPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof saleStatusFilters)[number]["value"]>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredSales = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesStatus =
        statusFilter === "ALL" || sale.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        sale.sale_number,
        sale.status,
        sale.customer?.document_number,
        sale.customer?.first_name,
        sale.customer?.last_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [sales, deferredSearchTerm, statusFilter]);

  const loadSales = useCallback(
    async (showToast = false) => {
      if (!token) {
        return;
      }

      try {
        if (showToast) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await saleService.listSales(token);
        setSales(response.filter((sale) => sale.status !== "PENDING_PAYMENT"));

        if (showToast) {
          toast.success("Ventas actualizadas.");
        }
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "No se pudieron cargar las ventas.";

        toast.error(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");

      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSales();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadSales, router]);

  return (
    <AppShell
      title="Ventas"
      description="Consulta ventas registradas, estados, clientes y montos."
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || isRefreshing}
            onClick={() => void loadSales(true)}
          >
            {isLoading || isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualizar
          </Button>
        </div>

        <Card>
          <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />
              Registro de ventas
            </CardTitle>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="w-full pl-9 lg:w-80"
                  placeholder="Buscar venta, cliente o DNI"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {saleStatusFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    size="sm"
                    variant={
                      statusFilter === filter.value ? "default" : "outline"
                    }
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <LoadingState label="Cargando ventas..." rows={5} />
            ) : filteredSales.length === 0 ? (
              <EmptyState
                title="No hay ventas para los filtros seleccionados."
                description="Cambia el estado o busca por número de venta, cliente o DNI."
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredSales.map((sale) => (
                    <Link
                      key={sale.id}
                      href={`/sales/${sale.id}`}
                      className="block rounded-lg border bg-white p-3 transition active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">
                            {sale.sale_number}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(sale.created_at)}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(sale.status)}>
                          {formatSaleStatus(sale.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3 border-t pt-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {formatCustomerName(sale)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {sale.items.length} artículo
                            {sale.items.length === 1 ? "" : "s"}
                            {sale.customer?.document_number
                              ? ` · ${sale.customer.document_type} ${sale.customer.document_number}`
                              : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-lg font-bold">
                          {formatMoney(sale.total)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="hidden max-h-[560px] overflow-auto rounded-xl border md:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Artículos</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{formatDateTime(sale.created_at)}</TableCell>
                        <TableCell className="font-medium">
                          {sale.sale_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{formatCustomerName(sale)}</p>
                            {sale.customer?.document_number ? (
                              <p className="text-xs text-slate-500">
                                {sale.customer.document_type}{" "}
                                {sale.customer.document_number}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{sale.items.length}</TableCell>
                        <TableCell>{formatMoney(sale.total)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(sale.status)}>
                            {formatSaleStatus(sale.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                            )}
                            href={`/sales/${sale.id}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
