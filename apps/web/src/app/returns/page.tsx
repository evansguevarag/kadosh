"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Copy,
  History,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/use-auth";
import { env } from "@/config/env";
import { productVariantService } from "@/features/products/product-variant-service";
import {
  customerDisplayDeviceService,
  type CustomerDisplayDevice,
} from "@/features/payments/customer-display-device-service";
import { returnService } from "@/features/returns/return-service";
import { saleService } from "@/features/sales/sale-service";
import {
  scannerService,
  type ScannerSession,
} from "@/features/scanner/scanner-service";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import type { ProductVariant, Sale } from "@/types/api";

function money(value: string | number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function saleCustomer(sale: Sale) {
  if (!sale.customer) return "Público general";
  return `${sale.customer.first_name} ${sale.customer.last_name || ""}`.trim();
}

function saleDate(sale: Sale) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(sale.paid_at || sale.created_at));
}

function StepTitle({
  number,
  title,
  complete = false,
}: {
  number: number;
  title: string;
  complete?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
          complete
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-300 bg-white text-slate-700",
        )}
      >
        {complete ? <Check className="h-4 w-4" /> : number}
      </span>
      <h2 className="font-semibold text-slate-950">{title}</h2>
    </div>
  );
}

export default function ReturnsPage() {
  const { token } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [devices, setDevices] = useState<CustomerDisplayDevice[]>([]);
  const [saleSearch, setSaleSearch] = useState("");
  const [saleId, setSaleId] = useState("");
  const [type, setType] = useState<"RETURN" | "EXCHANGE">("EXCHANGE");
  const [reason, setReason] = useState("PRODUCTO_DEFECTUOSO");
  const [condition, setCondition] = useState("DEFECTUOSO");
  const [resolution, setResolution] = useState("DEFECTIVE");
  const [settlement, setSettlement] = useState("");
  const [settlementReference, setSettlementReference] = useState("");
  const [settlementDeviceId, setSettlementDeviceId] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [replacementId, setReplacementId] = useState("");
  const [replacementQuantity, setReplacementQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerSession, setScannerSession] = useState<ScannerSession | null>(
    null,
  );
  const [scannerQr, setScannerQr] = useState("");
  const [scannerUrl, setScannerUrl] = useState("");
  const [isCreatingScanner, setIsCreatingScanner] = useState(false);
  const [isScannerPanelOpen, setIsScannerPanelOpen] = useState(false);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === saleId) ?? null,
    [saleId, sales],
  );
  const selectedReplacement = useMemo(
    () => variants.find((variant) => variant.id === replacementId) ?? null,
    [replacementId, variants],
  );
  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLowerCase();
    if (!search) return [];
    return sales
      .filter((sale) =>
        [
          sale.sale_number,
          saleCustomer(sale),
          sale.customer?.document_number,
          sale.customer?.phone,
          sale.total,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
      )
      .slice(0, 12);
  }, [saleSearch, sales]);
  const selectedItemCount = Object.values(quantities).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const returnedValue =
    selectedSale?.items.reduce(
      (total, item) =>
        total +
        (Number(item.subtotal) / item.quantity) * (quantities[item.id] || 0),
      0,
    ) ?? 0;
  const replacementValue =
    type === "EXCHANGE" && selectedReplacement
      ? Number(selectedReplacement.sale_price) * replacementQuantity
      : 0;
  const difference = replacementValue - returnedValue;
  const requiresSettlementReference = [
    "YAPE",
    "PLIN",
    "TRANSFER",
    "POS",
    "REFUND_TRANSFER",
  ].includes(settlement);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [salesResponse, variantsResponse, devicesResponse] = await Promise.all([
        saleService.listSales(token),
        productVariantService.listVariants(token),
        customerDisplayDeviceService.listDevices(token),
      ]);
      setSales(salesResponse.filter((sale) => sale.status === "PAID"));
      setVariants(
        variantsResponse.filter(
          (variant) => variant.is_active && variant.stock_quantity > 0,
        ),
      );
      setDevices(devicesResponse.filter((device) => device.is_active));
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron cargar las ventas pagadas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  function chooseSale(sale: Sale) {
    setSaleId(sale.id);
    setQuantities(
      sale.items.length === 1 ? { [sale.items[0].id]: sale.items[0].quantity } : {},
    );
    setSaleSearch("");
  }

  async function handleLinkPhone() {
    if (!token) return;
    try {
      setIsCreatingScanner(true);
      const session = await scannerService.createSession(
        token,
        "RECEIPT_LOOKUP",
      );
      const pageUrl = new URL(
        `/scanner/${session.id}/${session.pairing_token}`,
        env.scannerWebUrl || window.location.origin,
      );
      const apiUrl = new URL(env.scannerApiUrl || env.apiUrl);
      if (
        !env.scannerApiUrl &&
        !["localhost", "127.0.0.1"].includes(window.location.hostname) &&
        ["localhost", "127.0.0.1"].includes(apiUrl.hostname)
      )
        apiUrl.hostname = window.location.hostname;
      if (!env.scannerApiUrl)
        pageUrl.searchParams.set("api", apiUrl.toString());
      pageUrl.searchParams.set("mode", "RECEIPT_LOOKUP");
      setScannerUrl(pageUrl.toString());
      setScannerQr(
        await QRCode.toDataURL(pageUrl.toString(), {
          width: 220,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      );
      setScannerSession(session);
      setIsScannerPanelOpen(true);
      toast.success("Celular listo para escanear boletas.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudo vincular el celular.",
      );
    } finally {
      setIsCreatingScanner(false);
    }
  }

  async function handleCopyScannerUrl() {
    try {
      await navigator.clipboard.writeText(scannerUrl);
      toast.success("Enlace del escáner copiado.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  useEffect(() => {
    if (!scannerSession || !token || selectedSale) return;
    let lastScanId: string | null = null;
    let busy = false;
    const intervalId = window.setInterval(() => {
      if (busy) return;
      busy = true;
      void scannerService
        .pollSession(scannerSession.id, token, lastScanId)
        .then((response) => {
          if (response.purpose !== "RECEIPT_LOOKUP") return;
          for (const scan of response.scans) {
            lastScanId = scan.id;
            let tokenValue = scan.code.trim();
            try {
              const scannedUrl = new URL(tokenValue);
              tokenValue =
                scannedUrl.pathname.split("/").filter(Boolean).at(-1) ||
                tokenValue;
            } catch {}
            const sale = sales.find(
              (item) => item.receipt_token === tokenValue,
            );
            if (sale) {
              chooseSale(sale);
              toast.success(`Compra ${sale.sale_number} identificada.`);
              break;
            }
            toast.error("El QR no corresponde a una boleta pagada de Kadosh.");
          }
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, 1200);
    return () => window.clearInterval(intervalId);
  }, [sales, scannerSession, selectedSale, token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedSale) return;
    const items = selectedSale.items
      .filter((item) => (quantities[item.id] || 0) > 0)
      .map((item) => ({
        sale_item_id: item.id,
        quantity: quantities[item.id],
      }));
    if (!items.length) {
      toast.error("Indica qué producto recibió la tienda.");
      return;
    }
    try {
      setIsSubmitting(true);
      await returnService.create(
        {
          original_sale_id: selectedSale.id,
          transaction_type: type,
          reason,
          item_condition: condition,
          inventory_resolution: resolution,
          settlement_method: difference === 0 ? null : settlement || null,
          settlement_reference:
            difference === 0 ? null : settlementReference.trim() || null,
          settlement_device_id:
            settlement === "CULQI" ? settlementDeviceId : null,
          notes: notes || null,
          items,
          replacements:
            type === "EXCHANGE" && replacementId
              ? [
                  {
                    product_variant_id: replacementId,
                    quantity: replacementQuantity,
                  },
                ]
              : [],
        },
        token,
      );
      toast.success(
        type === "EXCHANGE"
          ? "Cambio registrado correctamente."
          : "Devolución registrada correctamente.",
      );
      setSaleId("");
      setQuantities({});
      setReplacementId("");
      setSettlement("");
      setSettlementReference("");
      setSettlementDeviceId("");
      setNotes("");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudo registrar la operación.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Cambios y devoluciones"
      description="Identifica la compra, recibe el producto y registra la solución para el cliente."
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex justify-end">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/returns/history"
          >
            <History className="h-4 w-4" />
            Ver historial
          </Link>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <StepTitle
                complete={Boolean(selectedSale)}
                number={1}
                title="Buscar la compra original"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedSale ? (
                <div className="rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Escáner de boletas
                      </p>
                      <p className="text-xs text-slate-500">
                        Celular {scannerSession ? "vinculado" : "no vinculado"}{" "}
                        · Solo identifica comprobantes
                      </p>
                    </div>
                    <Button
                      aria-expanded={isScannerPanelOpen}
                      aria-label={
                        isScannerPanelOpen
                          ? "Ocultar configuración del escáner"
                          : "Mostrar configuración del escáner"
                      }
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setIsScannerPanelOpen((current) => !current)
                      }
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isScannerPanelOpen ? "rotate-180" : ""}`}
                      />
                      {isScannerPanelOpen ? "Ocultar" : "Configurar"}
                    </Button>
                  </div>
                  {isScannerPanelOpen ? (
                    <div className="mt-3 border-t pt-3">
                      <Button
                        type="button"
                        variant={scannerSession ? "outline" : "default"}
                        disabled={isCreatingScanner}
                        onClick={() => void handleLinkPhone()}
                      >
                        {isCreatingScanner ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LinkIcon className="h-4 w-4" />
                        )}
                        {scannerSession
                          ? "Renovar celular"
                          : "Vincular celular"}
                      </Button>
                      {scannerQr ? (
                        <div className="mt-3 grid gap-4 rounded-lg border bg-slate-50 p-3 lg:grid-cols-[120px_1fr]">
                          <div
                            aria-label="QR para vincular celular como escáner de boletas"
                            className="aspect-square rounded-lg border bg-white bg-contain bg-center bg-no-repeat"
                            role="img"
                            style={{ backgroundImage: `url(${scannerQr})` }}
                          />
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-semibold">
                                Escanea este QR con el celular
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                El celular debe estar en la misma red WiFi. Este
                                modo no agrega productos a Caja.
                              </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                              <Input
                                readOnly
                                className="bg-white text-xs"
                                value={scannerUrl}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handleCopyScannerUrl()}
                              >
                                <Copy className="h-4 w-4" />
                                Copiar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selectedSale ? (
                <div className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-emerald-950">
                      {selectedSale.sale_number}
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      {saleCustomer(selectedSale)} ·{" "}
                      {selectedSale.customer?.document_number ||
                        "Sin documento"}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {saleDate(selectedSale)} · {money(selectedSale.total)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSaleId("");
                      setQuantities({});
                    }}
                  >
                    <X className="h-4 w-4" />
                    Cambiar venta
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9"
                      value={saleSearch}
                      onChange={(event) => setSaleSearch(event.target.value)}
                      placeholder="Número de compra, DNI, nombre, teléfono o monto"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Puedes pedir al cliente el número que aparece en su
                    comprobante, por ejemplo V-2026..., o buscarlo por sus
                    datos.
                  </p>
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando buscador...
                    </div>
                  ) : !saleSearch.trim() ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                      Escribe un dato de la compra o escanea el QR de la boleta
                      para identificarla.
                    </p>
                  ) : filteredSales.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                      No encontramos una venta pagada con esos datos.
                    </p>
                  ) : (
                    <div className="divide-y overflow-hidden rounded-lg border">
                      {filteredSales.map((sale) => (
                        <button
                          className="grid w-full gap-2 p-4 text-left transition hover:bg-slate-50 sm:grid-cols-[1fr_auto]"
                          key={sale.id}
                          type="button"
                          onClick={() => chooseSale(sale)}
                        >
                          <div>
                            <p className="font-semibold">{sale.sale_number}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {saleCustomer(sale)} ·{" "}
                              {sale.customer?.document_number ||
                                "Sin documento"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {saleDate(sale)} · {sale.items.length} producto
                              {sale.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <p className="font-bold sm:self-center">
                            {money(sale.total)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {selectedSale ? (
            <>
              <Card>
                <CardHeader>
                  <StepTitle
                    complete={selectedItemCount > 0}
                    number={2}
                    title="Indicar qué producto devuelve el cliente"
                  />
                </CardHeader>
                <CardContent>
                  <div className="divide-y rounded-lg border">
                    {selectedSale.items.map((item) => (
                      <div
                        className="grid gap-3 p-4 sm:grid-cols-[1fr_7rem] sm:items-center"
                        key={item.id}
                      >
                        <div>
                          <p className="font-semibold">{item.product_name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.variant_sku} ·{" "}
                            {[item.size, item.color]
                              .filter(Boolean)
                              .join(" / ") || "Sin variante"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Compró {item.quantity} a{" "}
                            {money(Number(item.subtotal) / item.quantity)} cada
                            uno
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`quantity-${item.id}`}>
                            Cantidad
                          </Label>
                          <Input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={quantities[item.id] || 0}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [item.id]: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <StepTitle number={3} title="Definir la solución" />
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={type === "EXCHANGE" ? "default" : "outline"}
                      onClick={() => setType("EXCHANGE")}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Cambiar producto
                    </Button>
                    <Button
                      type="button"
                      variant={type === "RETURN" ? "default" : "outline"}
                      onClick={() => {
                        setType("RETURN");
                        setReplacementId("");
                      }}
                    >
                      Devolver dinero o saldo
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      >
                        <option value="PRODUCTO_DEFECTUOSO">
                          Producto defectuoso
                        </option>
                        <option value="TALLA_COLOR">
                          Talla o color incorrecto
                        </option>
                        <option value="CAMBIO_OPINION">
                          Cambio de opinión
                        </option>
                        <option value="OTRO">Otro motivo</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estado recibido</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={condition}
                        onChange={(event) => setCondition(event.target.value)}
                      >
                        <option value="NUEVO">Nuevo y sin uso</option>
                        <option value="DEFECTUOSO">Defectuoso</option>
                        <option value="USADO">Con señales de uso</option>
                        <option value="DANADO">Dañado</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>¿Qué ocurrirá con el producto recibido?</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                    >
                      <option value="RESTOCK">
                        Volverá al stock para venta
                      </option>
                      <option value="DEFECTIVE">Quedará como defectuoso</option>
                      <option value="REVIEW">Pasará a revisión</option>
                      <option value="DAMAGE">Se registrará como merma</option>
                      <option value="SUPPLIER_RETURN">
                        Se devolverá al proveedor
                      </option>
                    </select>
                  </div>
                  {type === "EXCHANGE" ? (
                    <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 sm:grid-cols-[1fr_7rem]">
                      <div className="space-y-2">
                        <Label>Nuevo producto que llevará el cliente</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                          value={replacementId}
                          onChange={(event) =>
                            setReplacementId(event.target.value)
                          }
                          required
                        >
                          <option value="">
                            Buscar presentación de reemplazo
                          </option>
                          {variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.sku} ·{" "}
                              {[variant.size, variant.color]
                                .filter(Boolean)
                                .join(" / ")}{" "}
                              · {money(variant.sale_price)} · stock{" "}
                              {variant.stock_quantity}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          min="1"
                          max={selectedReplacement?.stock_quantity}
                          value={replacementQuantity}
                          onChange={(event) =>
                            setReplacementQuantity(Number(event.target.value))
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <StepTitle
                    number={4}
                    title="Revisar diferencia y confirmar"
                  />
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-950 p-4 text-white">
                    <div>
                      <p className="text-xs text-slate-400">Valor recibido</p>
                      <p className="mt-1 font-semibold">
                        {money(returnedValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Nuevo producto</p>
                      <p className="mt-1 font-semibold">
                        {money(replacementValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">
                        {difference > 0
                          ? "Cliente paga"
                          : difference < 0
                            ? "Tienda devuelve"
                            : "Diferencia"}
                      </p>
                      <p className="mt-1 font-semibold">
                        {money(Math.abs(difference))}
                      </p>
                    </div>
                  </div>
                  {difference !== 0 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>
                          {difference > 0
                            ? "¿Cómo pagará la diferencia?"
                            : "¿Cómo se devolverá la diferencia?"}
                        </Label>
                        <select
                          className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                          value={settlement}
                          onChange={(event) => {
                            setSettlement(event.target.value);
                            setSettlementReference("");
                            setSettlementDeviceId("");
                          }}
                          required
                        >
                          <option value="">Selecciona un método</option>
                          {difference > 0 ? (
                            <>
                              <option value="CASH">Efectivo</option>
                              <option value="YAPE">Yape</option>
                              <option value="PLIN">Plin</option>
                              <option value="TRANSFER">Transferencia</option>
                              <option value="POS">Tarjeta en POS</option>
                              <option value="CULQI">Culqi en tablet</option>
                            </>
                          ) : (
                            <>
                              <option value="REFUND_CASH">
                                Devolución en efectivo
                              </option>
                              <option value="REFUND_TRANSFER">
                                Devolución por transferencia
                              </option>
                            </>
                          )}
                        </select>
                      </div>
                      {requiresSettlementReference ? (
                        <div className="space-y-2">
                          <Label htmlFor="settlement-reference">
                            Código o referencia de operación
                          </Label>
                          <Input
                            id="settlement-reference"
                            value={settlementReference}
                            onChange={(event) =>
                              setSettlementReference(event.target.value)
                            }
                            placeholder="Ej. número de operación o voucher"
                            maxLength={120}
                            required
                          />
                        </div>
                      ) : null}
                      {settlement === "CULQI" ? (
                        <div className="space-y-2">
                          <Label htmlFor="settlement-device">Tablet de cobro</Label>
                          <select
                            id="settlement-device"
                            className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                            value={settlementDeviceId}
                            onChange={(event) => setSettlementDeviceId(event.target.value)}
                            required
                          >
                            <option value="">Selecciona una tablet</option>
                            {devices.map((device) => (
                              <option key={device.id} value={device.id}>{device.device_name}</option>
                            ))}
                          </select>
                          {devices.length === 0 ? <p className="text-xs text-slate-500">No hay tablets activas vinculadas.</p> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Detalle opcional de la atención"
                    />
                  </div>
                  <Button
                    className="h-11 w-full"
                    disabled={isSubmitting || selectedItemCount === 0}
                    type="submit"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Confirmar {type === "EXCHANGE" ? "cambio" : "devolución"}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}
        </form>
      </div>
    </AppShell>
  );
}
