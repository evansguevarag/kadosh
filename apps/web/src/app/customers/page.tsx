"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, LoadingState } from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { customerService } from "@/features/customers/customer-service";
import { ApiClientError } from "@/services/api-client";
import type { Customer } from "@/types/api";

export default function CustomersPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter((customer) => {
      const searchableText = [
        customer.document_number,
        customer.first_name,
        customer.last_name,
        customer.phone,
        customer.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [customers, deferredSearchTerm]);

  const loadCustomers = useCallback(
    async (manual = false) => {
      if (!token) {
        return;
      }

      try {
        if (manual) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await customerService.listCustomers(token);

        setCustomers(response);
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "No se pudieron cargar los clientes.";

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
      void loadCustomers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadCustomers, router]);

  return (
    <AppShell
      title="Clientes"
      description="Directorio de clientes registrados desde el flujo de ventas."
    >
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes registrados
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              {customers.length} cliente{customers.length === 1 ? "" : "s"} en
              la base local.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-full pl-9 sm:w-80"
                placeholder="Filtrar por DNI, nombre o correo"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={isRefreshing}
              onClick={() => void loadCustomers(true)}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingState label="Cargando clientes..." />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState
              title={
                customers.length === 0
                  ? "Todavía no hay clientes registrados."
                  : "No hay clientes que coincidan con el filtro."
              }
              description={
                customers.length === 0
                  ? "Se crearán desde Caja cuando busques un DNI durante la venta."
                  : "Prueba con DNI, nombre, teléfono o correo."
              }
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="rounded-lg border bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">
                          {customer.first_name} {customer.last_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {customer.document_type} {customer.document_number}
                        </p>
                      </div>
                      <Badge variant={customer.is_active ? "default" : "outline"}>
                        {customer.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid gap-2 border-t pt-3 text-sm">
                      <div className="flex min-w-0 justify-between gap-4">
                        <dt className="text-slate-500">Teléfono</dt>
                        <dd className="truncate font-medium">
                          {customer.phone || "-"}
                        </dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-4">
                        <dt className="text-slate-500">Correo</dt>
                        <dd className="truncate font-medium">
                          {customer.email || "-"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              <div className="hidden max-h-[560px] overflow-auto rounded-xl border md:block">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {customer.document_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            {customer.document_type}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>{customer.email || "-"}</TableCell>
                      <TableCell>
                        {customer.is_active ? "Activo" : "Inactivo"}
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
    </AppShell>
  );
}
