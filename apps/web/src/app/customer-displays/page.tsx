"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Loader2,
  MonitorSmartphone,
  Plus,
  PowerOff,
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
import {
  customerDisplayDeviceService,
  type CustomerDisplayDevice,
  type PairingCodeCreateResponse,
} from "@/features/payments/customer-display-device-service";
import { ApiClientError } from "@/services/api-client";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CustomerDisplaysPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [devices, setDevices] = useState<CustomerDisplayDevice[]>([]);
  const [deviceName, setDeviceName] = useState("Tablet Caja 1");
  const [pairingCode, setPairingCode] =
    useState<PairingCodeCreateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isDeactivatingDeviceId, setIsDeactivatingDeviceId] = useState("");

  const loadDevices = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await customerDisplayDeviceService.listDevices(token);

      setDevices(response);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron cargar las tablets.";

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
      void loadDevices();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadDevices, router]);

  async function handleCreatePairingCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    try {
      setIsGeneratingCode(true);

      const response = await customerDisplayDeviceService.createPairingCode(
        {
          device_name: deviceName,
        },
        token,
      );

      setPairingCode(response);

      toast.success("Código de vinculación generado correctamente.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo generar el código de vinculación.";

      toast.error(message);
    } finally {
      setIsGeneratingCode(false);
    }
  }

  async function handleDeactivateDevice(deviceId: string) {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    try {
      setIsDeactivatingDeviceId(deviceId);

      await customerDisplayDeviceService.deactivateDevice(deviceId, token);

      toast.success("Tablet desactivada correctamente.");
      await loadDevices();
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo desactivar la tablet.";

      toast.error(message);
    } finally {
      setIsDeactivatingDeviceId("");
    }
  }

  return (
    <AppShell
      title="Pantallas cliente"
      description="Vincula tablets y administra los dispositivos autorizados."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.5fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Vincular nueva tablet
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={handleCreatePairingCode}>
              <div className="space-y-2">
                <Label htmlFor="deviceName">Nombre de la tablet</Label>
                <Input
                  id="deviceName"
                  placeholder="Tablet Caja 1"
                  value={deviceName}
                  disabled={isGeneratingCode}
                  onChange={(event) => setDeviceName(event.target.value)}
                  required
                />
              </div>

              <Button
                className="w-full"
                type="submit"
                disabled={isGeneratingCode}
              >
                {isGeneratingCode ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  "Generar código de vinculación"
                )}
              </Button>
            </form>

            {pairingCode ? (
              <div className="mt-6 rounded-3xl border bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-500">
                  Código para ingresar en la tablet
                </p>

                <p className="mt-3 text-5xl font-bold tracking-[0.25em] text-slate-950">
                  {pairingCode.code}
                </p>

                <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Clock className="h-4 w-4" />
                  Expira: {formatDate(pairingCode.expires_at)}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  En la tablet abre la URL principal, presiona “Usar como
                  pantalla cliente” y escribe este código.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" />
              Tablets vinculadas
            </CardTitle>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando tablets...
              </div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-slate-500">
                Todavía no hay tablets vinculadas.
              </p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {devices.map((device) => (
                    <div key={device.id} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {device.device_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Última conexión: {formatDate(device.last_seen_at)}
                          </p>
                        </div>
                        <Badge variant={device.is_active ? "default" : "outline"}>
                          {device.is_active ? "Activa" : "Desactivada"}
                        </Badge>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        size="sm"
                        variant="outline"
                        disabled={
                          !device.is_active ||
                          isDeactivatingDeviceId === device.id
                        }
                        onClick={() => void handleDeactivateDevice(device.id)}
                      >
                        {isDeactivatingDeviceId === device.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PowerOff className="h-4 w-4" />
                        )}
                        Desactivar
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tablet</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Última conexión</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          {device.device_name}
                        </TableCell>
                        <TableCell>
                          {device.is_active ? "Activa" : "Desactivada"}
                        </TableCell>
                        <TableCell>{formatDate(device.last_seen_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !device.is_active ||
                              isDeactivatingDeviceId === device.id
                            }
                            onClick={() => void handleDeactivateDevice(device.id)}
                          >
                            {isDeactivatingDeviceId === device.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <PowerOff className="h-4 w-4" />
                                Desactivar
                              </>
                            )}
                          </Button>
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
