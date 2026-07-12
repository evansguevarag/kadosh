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
import JsBarcode from "jsbarcode";
import {
  Boxes,
  Download,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Wand2,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  productVariantService,
  type ProductVariantCreateRequest,
  type ProductVariantUpdateRequest,
} from "@/features/products/product-variant-service";
import { statusBadgeVariant } from "@/lib/status-format";
import { ApiClientError } from "@/services/api-client";
import type { Product, ProductVariant } from "@/types/api";

function buildInternalBarcode(sku: string) {
  const normalizedSkuNumber = sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const hashSeed = normalizedSkuNumber || String(Date.now());
  let hash = 0;

  for (const character of hashSeed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 100000000;
  }

  return `77${String(hash).padStart(8, "0")}`;
}

function getPrintableCode(variant: ProductVariant) {
  return variant.barcode || variant.sku;
}

function isCode128CCompatible(value: string) {
  return /^\d+$/.test(value) && value.length % 2 === 0;
}

function getBarcodeFormat(value: string) {
  return isCode128CCompatible(value) ? "CODE128C" : "CODE128";
}

function sortVariantsForLabels(variants: ProductVariant[]) {
  return [...variants].sort((firstVariant, secondVariant) =>
    [
      firstVariant.sku.localeCompare(secondVariant.sku),
      (firstVariant.color || "").localeCompare(secondVariant.color || ""),
      (firstVariant.size || "").localeCompare(secondVariant.size || ""),
    ].find((result) => result !== 0) ?? 0,
  );
}

function escapeCsvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number.isFinite(value) ? value : 0);
}

function PriceBreakdown({ costPrice, salePrice }: { costPrice: string; salePrice: string }) {
  const cost = Number(costPrice || 0);
  const finalPrice = Number(salePrice || 0);
  const taxableAmount = finalPrice / 1.18;
  const includedTax = finalPrice - taxableAmount;
  const estimatedProfit = finalPrice - cost;
  const marginPercentage = finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0;

  return (
    <div className="rounded-xl border bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-950">Precio final con IGV incluido</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        El cliente paga {formatMoney(finalPrice)}. El IGV del 18% ya está incluido y no se suma nuevamente al cobrar.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Base imponible</p>
          <p className="mt-1 font-semibold">{formatMoney(taxableAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">IGV incluido</p>
          <p className="mt-1 font-semibold">{formatMoney(includedTax)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Utilidad estimada</p>
          <p className={`mt-1 font-semibold ${estimatedProfit < 0 ? "text-red-600" : ""}`}>
            {formatMoney(estimatedProfit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Margen estimado</p>
          <p className={`mt-1 font-semibold ${marginPercentage < 0 ? "text-red-600" : ""}`}>
            {marginPercentage.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProductVariantsPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [productId, setProductId] = useState("");
  const [sku, setSku] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("35.00");
  const [salePrice, setSalePrice] = useState("79.90");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [minStockQuantity, setMinStockQuantity] = useState("3");
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );
  const [editSku, setEditSku] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editMinStockQuantity, setEditMinStockQuantity] = useState("");
  const [labelVariants, setLabelVariants] = useState<ProductVariant[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingVariant, setIsUpdatingVariant] = useState(false);
  const [isGeneratingMissingBarcodes, setIsGeneratingMissingBarcodes] =
    useState(false);
  const [updatingVariantId, setUpdatingVariantId] = useState<string | null>(
    null,
  );
  const sortedPrintableVariants = useMemo(
    () => sortVariantsForLabels(variants.filter((variant) => getPrintableCode(variant))),
    [variants],
  );
  const filteredVariants = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return variants.filter((variant) => {
      const matchesStatus = statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? variant.is_active : !variant.is_active);
      const product = products.find((item) => item.id === variant.product_id);
      const matchesSearch = !search || [variant.sku, variant.barcode, variant.size, variant.color, product?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [products, searchTerm, statusFilter, variants]);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const [productsResponse, variantsResponse] = await Promise.all([
        productVariantService.listProducts(token),
        productVariantService.listVariants(token),
      ]);

      const activeProducts = productsResponse.filter(
        (product) => product.is_active && product.status === "ACTIVE",
      );

      setProducts(activeProducts);
      setVariants(variantsResponse);

      if (activeProducts.length > 0) {
        setProductId((currentProductId) =>
          currentProductId || activeProducts[0].id,
        );
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cargar el catálogo.";

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

  function resetCreateForm() {
    setSku("");
    setSize("");
    setColor("");
    setBarcode("");
    setCostPrice("35.00");
    setSalePrice("79.90");
    setStockQuantity("0");
    setMinStockQuantity("3");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    if (!productId) {
      toast.error("Selecciona un producto.");

      return;
    }

    const payload: ProductVariantCreateRequest = {
      product_id: productId,
      sku,
      size: size || null,
      color: color || null,
      barcode: barcode || null,
      cost_price: costPrice,
      sale_price: salePrice,
      stock_quantity: Number(stockQuantity),
      min_stock_quantity: Number(minStockQuantity),
    };

    try {
      setIsSubmitting(true);

      const createdVariant = await productVariantService.createVariant(
        payload,
        token,
      );

      setVariants((currentVariants) => [createdVariant, ...currentVariants]);
      resetCreateForm();
      setIsCreateDialogOpen(false);

      toast.success("Presentación creada correctamente.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo crear la presentación.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGenerateBarcode() {
    setBarcode(buildInternalBarcode(sku));
  }

  async function handleGenerateMissingBarcodes() {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    try {
      setIsGeneratingMissingBarcodes(true);

      const response = await productVariantService.generateMissingBarcodes(
        token,
      );

      if (response.updated_count === 0) {
        toast.info("Todas las presentaciones ya tienen código de barras.");

        return;
      }

      setVariants((currentVariants) =>
        currentVariants.map((currentVariant) => {
          const updatedVariant = response.variants.find(
            (variant) => variant.id === currentVariant.id,
          );

          return updatedVariant ?? currentVariant;
        }),
      );

      toast.success(
        `${response.updated_count} código${
          response.updated_count === 1 ? "" : "s"
        } generado${response.updated_count === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron generar los códigos faltantes.";

      toast.error(message);
    } finally {
      setIsGeneratingMissingBarcodes(false);
    }
  }

  function handlePrintLabel(variant: ProductVariant) {
    setLabelVariants([variant]);

    window.setTimeout(() => {
      window.print();
    }, 50);
  }

  function handlePrintAllLabels() {
    if (sortedPrintableVariants.length === 0) {
      toast.error("No hay presentaciones con código para imprimir.");

      return;
    }

    setLabelVariants(sortedPrintableVariants);

    window.setTimeout(() => {
      window.print();
    }, 50);
  }

  function handleExportBarcodesCsv() {
    if (sortedPrintableVariants.length === 0) {
      toast.error("No hay códigos para exportar.");

      return;
    }

    const rows = [
      [
        "sku",
        "codigo_barras",
        "talla",
        "color",
        "precio_venta",
        "stock",
        "estado",
      ],
      ...sortedPrintableVariants.map((variant) => [
        variant.sku,
        getPrintableCode(variant),
        variant.size || "",
        variant.color || "",
        variant.sale_price,
        variant.stock_quantity,
        variant.is_active ? "ACTIVA" : "INACTIVA",
      ]),
    ];
    const csv = `\uFEFF${rows
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `kadosh-codigos-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openEditDialog(variant: ProductVariant) {
    setEditingVariant(variant);
    setEditSku(variant.sku);
    setEditSize(variant.size || "");
    setEditColor(variant.color || "");
    setEditBarcode(variant.barcode || "");
    setEditCostPrice(variant.cost_price);
    setEditSalePrice(variant.sale_price);
    setEditMinStockQuantity(String(variant.min_stock_quantity));
  }

  function handleGenerateEditBarcode() {
    setEditBarcode(buildInternalBarcode(editSku));
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !editingVariant) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    const payload: ProductVariantUpdateRequest = {
      sku: editSku,
      size: editSize || null,
      color: editColor || null,
      barcode: editBarcode || null,
      cost_price: editCostPrice,
      sale_price: editSalePrice,
      min_stock_quantity: Number(editMinStockQuantity),
    };

    try {
      setIsUpdatingVariant(true);

      const updatedVariant = await productVariantService.updateVariant(
        editingVariant.id,
        payload,
        token,
      );

      setVariants((currentVariants) =>
        currentVariants.map((currentVariant) =>
          currentVariant.id === updatedVariant.id
            ? updatedVariant
            : currentVariant,
        ),
      );
      setEditingVariant(null);

      toast.success("Presentación actualizada correctamente.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo actualizar la presentación.";

      toast.error(message);
    } finally {
      setIsUpdatingVariant(false);
    }
  }

  async function handleToggleVariant(variant: ProductVariant) {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    const nextIsActive = !variant.is_active;

    try {
      setUpdatingVariantId(variant.id);

      const updatedVariant = await productVariantService.updateVariant(
        variant.id,
        {
          is_active: nextIsActive,
          status: nextIsActive ? "ACTIVE" : "INACTIVE",
        },
        token,
      );

      setVariants((currentVariants) =>
        currentVariants.map((currentVariant) =>
          currentVariant.id === updatedVariant.id
            ? updatedVariant
            : currentVariant,
        ),
      );

      toast.success(
        nextIsActive ? "Presentación activada." : "Presentación desactivada.",
      );
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo actualizar el estado de la presentación.";

      toast.error(message);
    } finally {
      setUpdatingVariantId(null);
    }
  }

  return (
    <AppShell
      title="Catálogo"
      description="Gestiona presentaciones por talla, color, SKU, código, precio y stock."
    >
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            {variants.length} presentación{variants.length === 1 ? "" : "es"} registrada{variants.length === 1 ? "" : "s"}
          </div>
          <Button
            type="button"
            disabled={products.length === 0}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nueva presentación
          </Button>
        </div>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Presentaciones registradas
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isGeneratingMissingBarcodes || variants.length === 0}
                onClick={handleGenerateMissingBarcodes}
              >
                {isGeneratingMissingBarcodes ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Generar faltantes
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sortedPrintableVariants.length === 0}
                onClick={handleExportBarcodesCsv}
              >
                <Download className="h-4 w-4" />
                Exportar códigos
              </Button>
              <Button
                type="button"
                disabled={sortedPrintableVariants.length === 0}
                onClick={handlePrintAllLabels}
              >
                <Printer className="h-4 w-4" />
                Imprimir todas
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
              <Input placeholder="Buscar SKU, código, producto, talla o color" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
              <select className="h-10 rounded-md border bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Inactivas</option></select>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando catálogo...
              </div>
            ) : filteredVariants.length === 0 ? (
              <p className="text-sm text-slate-500">
                Todavía no hay presentaciones registradas.
              </p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredVariants.map((variant) => (
                    <div key={variant.id} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{variant.sku}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {variant.barcode || "Sin código"}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(variant.status)}>
                          {variant.is_active ? "Activa" : "Inactiva"}
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
                          <p className="text-xs text-slate-500">Precio / stock</p>
                          <p className="mt-1 font-semibold">
                            S/ {variant.sale_price} · {variant.stock_quantity}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-[auto_1fr_1fr] gap-2">
                        <button
                          aria-label={
                            variant.is_active
                              ? `Desactivar ${variant.sku}`
                              : `Activar ${variant.sku}`
                          }
                          aria-checked={variant.is_active}
                          className={`relative h-8 w-12 self-center rounded-full transition ${
                            variant.is_active ? "bg-slate-950" : "bg-slate-300"
                          }`}
                          disabled={updatingVariantId === variant.id}
                          role="switch"
                          type="button"
                          onClick={() => void handleToggleVariant(variant)}
                        >
                          <span
                            className={`absolute top-1.5 h-5 w-5 rounded-full bg-white transition ${
                              variant.is_active ? "left-6" : "left-1"
                            }`}
                          />
                        </button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => openEditDialog(variant)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => handlePrintLabel(variant)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Etiqueta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Talla</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredVariants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">
                          {variant.sku}
                        </TableCell>
                        <TableCell>{variant.barcode || "-"}</TableCell>
                        <TableCell>{variant.size || "-"}</TableCell>
                        <TableCell>{variant.color || "-"}</TableCell>
                        <TableCell>S/ {variant.sale_price}</TableCell>
                        <TableCell>
                          {variant.stock_quantity} / mín.{" "}
                          {variant.min_stock_quantity}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              aria-checked={variant.is_active}
                              className={`relative h-6 w-11 rounded-full transition ${
                                variant.is_active
                                  ? "bg-slate-950"
                                  : "bg-slate-300"
                              }`}
                              disabled={updatingVariantId === variant.id}
                              role="switch"
                              type="button"
                              onClick={() => void handleToggleVariant(variant)}
                            >
                              <span
                                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                                  variant.is_active ? "left-6" : "left-1"
                                }`}
                              />
                            </button>
                            <Badge variant={statusBadgeVariant(variant.status)}>
                              {variant.is_active ? "Activa" : "Inactiva"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => openEditDialog(variant)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => handlePrintLabel(variant)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Etiqueta
                          </Button>
                          </div>
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

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(isOpen) => {
          setIsCreateDialogOpen(isOpen);

          if (!isOpen && !isSubmitting) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva presentación</DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="product">Producto</Label>
              <select
                id="product"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={productId}
                disabled={isSubmitting || products.length === 0}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  placeholder="POL-OVER-BLK-M"
                  value={sku}
                  disabled={isSubmitting}
                  onChange={(event) => setSku(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    id="barcode"
                    placeholder="Se genera si queda vacío"
                    value={barcode}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      setBarcode(event.target.value.trim().toUpperCase())
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={handleGenerateBarcode}
                  >
                    Generar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="size">Talla</Label>
                <Input
                  id="size"
                  placeholder="M"
                  value={size}
                  disabled={isSubmitting}
                  onChange={(event) => setSize(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Negro"
                  value={color}
                  disabled={isSubmitting}
                  onChange={(event) => setColor(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Precio costo</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  disabled={isSubmitting}
                  onChange={(event) => setCostPrice(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio venta</Label>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  disabled={isSubmitting}
                  onChange={(event) => setSalePrice(event.target.value)}
                  required
                />
              </div>
            </div>

            <PriceBreakdown costPrice={costPrice} salePrice={salePrice} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stockQuantity">Stock inicial</Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  min="0"
                  value={stockQuantity}
                  disabled={isSubmitting}
                  onChange={(event) => setStockQuantity(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStockQuantity">Stock mínimo</Label>
                <Input
                  id="minStockQuantity"
                  type="number"
                  min="0"
                  value={minStockQuantity}
                  disabled={isSubmitting}
                  onChange={(event) => setMinStockQuantity(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">
              Puedes usar el código real del proveedor o dejarlo vacío para
              generar un código interno desde el SKU.
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear presentación"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingVariant !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingVariant(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar presentación</DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleEditSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editSku">SKU</Label>
                <Input
                  id="editSku"
                  value={editSku}
                  disabled={isUpdatingVariant}
                  onChange={(event) => setEditSku(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editBarcode">Código de barras</Label>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    id="editBarcode"
                    value={editBarcode}
                    disabled={isUpdatingVariant}
                    onChange={(event) =>
                      setEditBarcode(event.target.value.trim().toUpperCase())
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUpdatingVariant}
                    onClick={handleGenerateEditBarcode}
                  >
                    Generar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editSize">Talla</Label>
                <Input
                  id="editSize"
                  value={editSize}
                  disabled={isUpdatingVariant}
                  onChange={(event) => setEditSize(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editColor">Color</Label>
                <Input
                  id="editColor"
                  value={editColor}
                  disabled={isUpdatingVariant}
                  onChange={(event) => setEditColor(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="editCostPrice">Precio costo</Label>
                <Input
                  id="editCostPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editCostPrice}
                  disabled={isUpdatingVariant}
                  onChange={(event) => setEditCostPrice(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editSalePrice">Precio venta</Label>
                <Input
                  id="editSalePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editSalePrice}
                  disabled={isUpdatingVariant}
                  onChange={(event) => setEditSalePrice(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editMinStockQuantity">Stock mínimo</Label>
                <Input
                  id="editMinStockQuantity"
                  type="number"
                  min="0"
                  value={editMinStockQuantity}
                  disabled={isUpdatingVariant}
                  onChange={(event) =>
                    setEditMinStockQuantity(event.target.value)
                  }
                  required
                />
              </div>
            </div>

            <PriceBreakdown
              costPrice={editCostPrice}
              salePrice={editSalePrice}
            />

            <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">
              Stock actual: {editingVariant?.stock_quantity ?? 0}. Para sumar,
              retirar o ajustar unidades usa el módulo Inventario.
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isUpdatingVariant}
                onClick={() => setEditingVariant(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdatingVariant}>
                {isUpdatingVariant ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {labelVariants.length > 0 ? (
        <VariantLabelsPrintView variants={labelVariants} />
      ) : null}
    </AppShell>
  );
}

function BarcodeSvg({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    JsBarcode(svgRef.current, value, {
      displayValue: false,
      format: getBarcodeFormat(value),
      height: 34,
      margin: 0,
      width: 1.15,
    });
  }, [value]);

  return (
    <svg
      ref={svgRef}
      aria-label={`Código de barras ${value}`}
      className="mx-auto h-[40px] w-full"
      role="img"
    />
  );
}

function VariantLabelsPrintView({ variants }: { variants: ProductVariant[] }) {
  const sortedVariants = sortVariantsForLabels(variants);

  return (
    <section className="hidden min-h-screen bg-white text-slate-950 print:block">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 4mm;
        }

        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <div className="mx-auto grid w-[202mm] grid-cols-[99mm_99mm] gap-x-[4mm] gap-y-[4mm]">
        {sortedVariants.map((variant) => {
          const printableCode = getPrintableCode(variant);

          return (
            <div
              key={variant.id}
              className="flex h-[89mm] break-inside-avoid flex-col overflow-hidden border border-slate-950 px-[4mm] py-[3mm] text-center"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Kadosh
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                  Etiqueta interna de venta
                </p>
              </div>
              <p className="mt-[2mm] min-h-[7mm] text-xl font-bold leading-tight">
                {variant.sku}
              </p>
              <div className="mt-[2mm] grid grid-cols-2 gap-[3mm] text-sm">
                <div className="border border-slate-300 px-2 py-[1.5mm]">
                  <p className="text-[9px] uppercase text-slate-500">Talla</p>
                  <p className="mt-0.5 font-semibold">{variant.size || "-"}</p>
                </div>
                <div className="border border-slate-300 px-2 py-[1.5mm]">
                  <p className="text-[9px] uppercase text-slate-500">Color</p>
                  <p className="mt-0.5 font-semibold">{variant.color || "-"}</p>
                </div>
              </div>
              <p className="mt-[2mm] text-3xl font-bold leading-none">
                S/ {variant.sale_price}
              </p>
              <div className="mt-auto overflow-hidden border-y border-slate-950 px-2 py-[2mm]">
                <BarcodeSvg value={printableCode} />
                <p className="mt-[1mm] break-all font-mono text-[10px] font-semibold leading-tight tracking-wider">
                  {printableCode}
                </p>
                <p className="mt-[1mm] text-[8px] leading-tight text-slate-500">
                  Código para escaneo en Caja
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
