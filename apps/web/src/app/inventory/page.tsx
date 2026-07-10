"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  History,
  Loader2,
  RotateCcw,
  ScanBarcode,
  Search,
  SlidersHorizontal,
} from "lucide-react";
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
  inventoryService,
  type InventoryMovement,
  type InventoryMovementCreateRequest,
} from "@/features/inventory/inventory-service";
import { productVariantService } from "@/features/products/product-variant-service";
import { ApiClientError } from "@/services/api-client";
import type { ProductVariant } from "@/types/api";

const movementTypes = ["ENTRADA", "SALIDA", "AJUSTE", "DEVOLUCION"] as const;
const inventoryTabs = ["STOCK", "AJUSTES", "HISTORIAL"] as const;

const movementConfig = {
  ENTRADA: {
    label: "Entrada",
    icon: ArrowUp,
    reason: "Ingreso de mercadería.",
    description: "Suma unidades recibidas de proveedor.",
    badge: "default",
  },
  SALIDA: {
    label: "Salida",
    icon: ArrowDown,
    reason: "Salida manual de inventario.",
    description: "Resta unidades por daño, pérdida o uso interno.",
    badge: "destructive",
  },
  AJUSTE: {
    label: "Corrección por conteo",
    icon: SlidersHorizontal,
    reason: "Ajuste por conteo físico.",
    description: "Reemplaza el stock por la cantidad realmente contada.",
    badge: "secondary",
  },
  DEVOLUCION: {
    label: "Devolución",
    icon: RotateCcw,
    reason: "Devolución registrada.",
    description: "Suma una devolución apta para volver a venderse.",
    badge: "outline",
  },
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMovementDelta(movement: InventoryMovement) {
  return movement.new_stock - movement.previous_stock;
}

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
}

export default function InventoryPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productVariantId, setProductVariantId] = useState("");
  const [variantCode, setVariantCode] = useState("");
  const [movementType, setMovementType] =
    useState<(typeof movementTypes)[number]>("ENTRADA");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(movementConfig.ENTRADA.reason);
  const [historyVariantId, setHistoryVariantId] = useState("ALL");
  const [activeTab, setActiveTab] =
    useState<(typeof inventoryTabs)[number]>("STOCK");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFindingVariant, setIsFindingVariant] = useState(false);
  const variantCodeInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoadedDataRef = useRef(false);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === productVariantId) ?? null,
    [productVariantId, variants],
  );

  const resultingStock = useMemo(() => {
    if (!selectedVariant) {
      return null;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return null;
    }

    if (movementType === "AJUSTE") {
      return parsedQuantity;
    }

    if (movementType === "SALIDA") {
      return selectedVariant.stock_quantity - parsedQuantity;
    }

    return selectedVariant.stock_quantity + parsedQuantity;
  }, [movementType, quantity, selectedVariant]);

  const filteredMovements = useMemo(() => {
    if (historyVariantId === "ALL") {
      return movements;
    }

    return movements.filter(
      (movement) => movement.product_variant_id === historyVariantId,
    );
  }, [historyVariantId, movements]);

  const totalStock = useMemo(
    () =>
      variants.reduce(
        (currentTotal, variant) => currentTotal + variant.stock_quantity,
        0,
      ),
    [variants],
  );

  const lowStockCount = useMemo(
    () =>
      variants.filter(
        (variant) => variant.stock_quantity <= variant.min_stock_quantity,
      ).length,
    [variants],
  );

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      if (!hasLoadedDataRef.current) {
        setIsLoading(true);
      }

      const [variantsResponse, movementsResponse] = await Promise.all([
        inventoryService.listVariants(token),
        inventoryService.listMovements(token),
      ]);

      const activeVariants = variantsResponse.filter(
        (variant) => variant.is_active && variant.status === "ACTIVE",
      );

      setVariants(activeVariants);
      setMovements(movementsResponse);

    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cargar la información de inventario.";

      toast.error(message);
    } finally {
      hasLoadedDataRef.current = true;
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

  function handleMovementTypeChange(nextMovementType: typeof movementType) {
    setMovementType(nextMovementType);
    setReason(movementConfig[nextMovementType].reason);
  }

  async function handleFindVariantByCode() {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    const normalizedCode = variantCode.trim();

    if (!normalizedCode) {
      toast.error("Ingresa o escanea un código de barras.");
      variantCodeInputRef.current?.focus();

      return;
    }

    try {
      setIsFindingVariant(true);

      const localVariant = variants.find(
        (variant) =>
          variant.barcode?.trim().toUpperCase() === normalizedCode.toUpperCase() ||
          variant.sku.trim().toUpperCase() === normalizedCode.toUpperCase(),
      );
      const foundVariant =
        localVariant ??
        (await productVariantService.getVariantByCode(normalizedCode, token));

      setProductVariantId(foundVariant.id);
      setVariantCode(foundVariant.barcode || normalizedCode);
      toast.success(`Presentación encontrada: ${foundVariant.sku}`);
    } catch (error) {
      setProductVariantId("");

      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se encontró una presentación activa con ese código.";

      toast.error(message);
    } finally {
      setIsFindingVariant(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    if (!productVariantId) {
      toast.error("Selecciona una presentación.");

      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      toast.error("La cantidad debe ser un número entero mayor a cero.");

      return;
    }

    if (!reason.trim()) {
      toast.error("Ingresa un motivo para el movimiento.");

      return;
    }

    const payload: InventoryMovementCreateRequest = {
      product_variant_id: productVariantId,
      movement_type: movementType,
      quantity: parsedQuantity,
      reason: reason.trim(),
    };

    try {
      setIsSubmitting(true);

      const createdMovement = await inventoryService.createMovement(
        payload,
        token,
      );

      setMovements((currentMovements) => [
        createdMovement,
        ...currentMovements,
      ]);
      setQuantity("1");
      setReason(movementConfig[movementType].reason);
      setVariantCode("");
      setProductVariantId("");

      toast.success("Movimiento registrado correctamente.");
      await loadData();
      variantCodeInputRef.current?.focus();
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo registrar el movimiento.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Inventario"
      description="Controla entradas, salidas, devoluciones y ajustes de stock."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <InventoryMetric label="Stock total" value={totalStock} />
        <InventoryMetric label="Presentaciones activas" value={variants.length} />
        <InventoryMetric label="Bajo stock" value={lowStockCount} tone="warn" />
      </div>

      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-2">
          {inventoryTabs.map((tab) => (
            <Button
              key={tab}
              type="button"
              variant={activeTab === tab ? "default" : "ghost"}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "STOCK"
                ? "Stock"
                : tab === "AJUSTES"
                  ? "Ajustes"
                  : "Historial"}
            </Button>
          ))}
        </div>

        {activeTab === "STOCK" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                Stock actual
              </CardTitle>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <LoadingState label="Cargando stock..." rows={5} />
              ) : variants.length === 0 ? (
                <EmptyState title="Todavía no hay presentaciones activas." />
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {variants.map((variant) => {
                      const isLowStock =
                        variant.stock_quantity <= variant.min_stock_quantity;

                      return (
                        <div
                          key={variant.id}
                          className="rounded-lg border bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {variant.sku}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {variant.barcode || "Sin código"}
                              </p>
                            </div>
                            <Badge variant={isLowStock ? "destructive" : "default"}>
                              {isLowStock ? "Bajo stock" : "Disponible"}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500">Presentación</p>
                              <p className="mt-1 font-medium">
                                {[variant.size, variant.color]
                                  .filter(Boolean)
                                  .join(" · ") || "-"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Stock / mínimo</p>
                              <p className="mt-1 text-lg font-bold">
                                {variant.stock_quantity}
                                <span className="text-sm font-normal text-slate-400">
                                  {" "}/ {variant.min_stock_quantity}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden max-h-[560px] overflow-auto rounded-xl border md:block">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white">
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Talla</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Mínimo</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {variants.map((variant) => {
                        const isLowStock =
                          variant.stock_quantity <= variant.min_stock_quantity;

                        return (
                          <TableRow key={variant.id}>
                            <TableCell className="font-medium">
                              {variant.sku}
                            </TableCell>
                            <TableCell>{variant.barcode || "-"}</TableCell>
                            <TableCell>{variant.size || "-"}</TableCell>
                            <TableCell>{variant.color || "-"}</TableCell>
                            <TableCell>{variant.stock_quantity}</TableCell>
                            <TableCell>{variant.min_stock_quantity}</TableCell>
                            <TableCell>
                              <Badge
                                variant={isLowStock ? "destructive" : "default"}
                              >
                                {isLowStock ? "Bajo stock" : "Disponible"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "AJUSTES" ? (
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Movimiento de stock
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-2 sm:grid-cols-2">
                {movementTypes.map((type) => {
                  const config = movementConfig[type];
                  const Icon = config.icon;
                  const isSelected = movementType === type;

                  return (
                    <button
                      key={type}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${
                        isSelected
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                      disabled={isSubmitting}
                      type="button"
                      onClick={() => handleMovementTypeChange(type)}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="block font-medium">{config.label}</span>
                        <span
                          className={`mt-1 block text-xs ${
                            isSelected ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {config.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="variantCode">Código de barras</Label>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      ref={variantCodeInputRef}
                      id="variantCode"
                      className="pl-9"
                      value={variantCode}
                      disabled={isLoading || isSubmitting || isFindingVariant}
                      placeholder="Escanea o escribe el código"
                      autoComplete="off"
                      onChange={(event) => {
                        setVariantCode(event.target.value);
                        setProductVariantId("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleFindVariantByCode();
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isLoading ||
                      isSubmitting ||
                      isFindingVariant ||
                      !variantCode.trim()
                    }
                    onClick={() => void handleFindVariantByCode()}
                  >
                    {isFindingVariant ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Con un lector USB, escanea el código y la presentación se
                  seleccionará al presionar Enter automáticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="variant">O seleccionar manualmente</Label>
                <select
                  id="variant"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={productVariantId}
                  disabled={isLoading || isSubmitting}
                  onChange={(event) => {
                    const nextVariantId = event.target.value;
                    const nextVariant = variants.find(
                      (variant) => variant.id === nextVariantId,
                    );

                    setProductVariantId(nextVariantId);
                    setVariantCode(nextVariant?.barcode || "");
                  }}
                  required
                >
                  <option value="">Selecciona una presentación</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.sku} | {variant.size || "-"} |{" "}
                      {variant.color || "-"} | Stock {variant.stock_quantity}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVariant ? (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">SKU</span>
                    <span className="font-semibold">{selectedVariant.sku}</span>
                  </div>

                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-slate-500">Código</span>
                    <span className="font-semibold">
                      {selectedVariant.barcode || "-"}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-slate-500">Presentación</span>
                    <span className="font-semibold">
                      {[selectedVariant.size, selectedVariant.color]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-slate-500">Stock actual</span>
                    <span className="font-semibold">
                      {selectedVariant.stock_quantity}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-slate-500">Stock mínimo</span>
                    <span className="font-semibold">
                      {selectedVariant.min_stock_quantity}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="quantity">
                  {movementType === "AJUSTE"
                    ? "Stock final contado"
                    : "Cantidad"}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  disabled={isSubmitting}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </div>

              {selectedVariant && resultingStock !== null ? (
                <div
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                    resultingStock < 0
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "bg-slate-50"
                  }`}
                >
                  <span>
                    {movementType === "AJUSTE"
                      ? "Resultado del conteo"
                      : "Stock después del movimiento"}
                  </span>
                  <span className="font-semibold">
                    {selectedVariant.stock_quantity} → {resultingStock}
                  </span>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo</Label>
                <Input
                  id="reason"
                  value={reason}
                  disabled={isSubmitting}
                  onChange={(event) => setReason(event.target.value)}
                  required
                />
              </div>

              <Button
                className="w-full"
                type="submit"
                disabled={
                  isSubmitting ||
                  (resultingStock !== null && resultingStock < 0)
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Boxes className="h-4 w-4" />
                    Registrar movimiento
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          </Card>
        ) : null}

        {activeTab === "HISTORIAL" ? (
          <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de movimientos
            </CardTitle>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={historyVariantId}
              disabled={isLoading}
              onChange={(event) => setHistoryVariantId(event.target.value)}
            >
              <option value="ALL">Todas las presentaciones</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.sku}
                </option>
              ))}
            </select>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <LoadingState label="Cargando movimientos..." rows={5} />
            ) : filteredMovements.length === 0 ? (
              <EmptyState title="Todavía no hay movimientos registrados." />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredMovements.map((movement) => {
                    const variant = variants.find(
                      (currentVariant) =>
                        currentVariant.id === movement.product_variant_id,
                    );
                    const delta = getMovementDelta(movement);
                    const config =
                      movementConfig[
                        movement.movement_type as typeof movementType
                      ];

                    return (
                      <div
                        key={movement.id}
                        className="rounded-lg border bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {variant?.sku ?? "Presentación"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(movement.created_at)}
                            </p>
                          </div>
                          <Badge variant={config?.badge ?? "outline"}>
                            {config?.label ?? movement.movement_type}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                          <div>
                            <p className="text-xs text-slate-500">Stock</p>
                            <p className="mt-1 font-medium">
                              {movement.previous_stock} → {movement.new_stock}
                            </p>
                          </div>
                          <p
                            className={`text-xl font-bold ${
                              delta >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {formatDelta(delta)}
                          </p>
                        </div>
                        {movement.reason ? (
                          <p className="mt-3 break-words text-sm text-slate-500">
                            {movement.reason}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden max-h-[560px] overflow-auto rounded-xl border md:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cambio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredMovements.map((movement) => {
                      const variant = variants.find(
                        (currentVariant) =>
                          currentVariant.id === movement.product_variant_id,
                      );
                      const delta = getMovementDelta(movement);
                      const config =
                        movementConfig[
                          movement.movement_type as typeof movementType
                        ];

                      return (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDate(movement.created_at)}</TableCell>
                          <TableCell className="font-medium">
                            {variant?.sku ?? "Presentación"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config?.badge ?? "outline"}>
                              {config?.label ?? movement.movement_type}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={
                              delta >= 0 ? "text-emerald-700" : "text-red-700"
                            }
                          >
                            {formatDelta(delta)}
                          </TableCell>
                          <TableCell>
                            {movement.previous_stock} → {movement.new_stock}
                          </TableCell>
                          <TableCell className="max-w-56 truncate text-slate-500">
                            {movement.reason || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function InventoryMetric({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "warn";
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-slate-500">{label}</p>
        <p
          className={`mt-2 text-2xl font-bold ${
            tone === "warn" ? "text-amber-700" : "text-slate-950"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
