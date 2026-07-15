"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderCog, Loader2, Package, Pencil, Plus, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/use-auth";
import {
  productService,
  type ProductCreateRequest,
  type ProductUpdateRequest,
} from "@/features/products/product-service";
import { statusBadgeVariant } from "@/lib/status-format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import type { Category, Product } from "@/types/api";

export default function ProductsPage() {
  const router = useRouter();
  const { token, isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role_name === "ADMIN";

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("Kadosh");
  const [description, setDescription] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickCategoryOpen, setIsQuickCategoryOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickCategoryDescription, setQuickCategoryDescription] = useState("");
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(
    null,
  );
  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );
  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchesStatus = statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? product.is_active : !product.is_active);
      const matchesSearch = !search || [product.name, product.brand, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [products, searchTerm, statusFilter]);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const [categoriesResponse, productsResponse] = await Promise.all([
        isAdmin
          ? productService.listManagedCategories(token)
          : productService.listCategories(token),
        productService.listProducts(token),
      ]);

      setCategories(categoriesResponse);
      setProducts(productsResponse);

      const firstActiveCategory = categoriesResponse.find(
        (category) => category.is_active,
      );

      if (firstActiveCategory) {
        setCategoryId((currentCategoryId) =>
          currentCategoryId || firstActiveCategory.id,
        );
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron cargar los productos.";

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, token]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    if (isQuickCategoryOpen) {
      await handleQuickCategorySubmit();

      return;
    }

    if (!categoryId) {
      toast.error("Selecciona una categoría.");

      return;
    }

    const payload: ProductCreateRequest = {
      category_id: categoryId,
      name,
      brand,
      description: description || null,
    };

    try {
      setIsSubmitting(true);

      const createdProduct = await productService.createProduct(payload, token);

      setProducts((currentProducts) => [createdProduct, ...currentProducts]);
      setName("");
      setDescription("");
      setBrand("Kadosh");
      setIsCreateDialogOpen(false);

      toast.success("Producto creado correctamente.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo crear el producto.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeQuickCategoryForm() {
    setIsQuickCategoryOpen(false);
    setQuickCategoryName("");
    setQuickCategoryDescription("");
  }

  async function handleQuickCategorySubmit() {
    if (!token || !quickCategoryName.trim()) {
      return;
    }

    try {
      setIsCreatingCategory(true);
      const createdCategory = await productService.createCategory(
        {
          name: quickCategoryName.trim(),
          description: quickCategoryDescription.trim() || null,
        },
        token,
      );

      setCategories((currentCategories) =>
        [...currentCategories, createdCategory].sort((left, right) =>
          left.name.localeCompare(right.name, "es"),
        ),
      );
      setCategoryId(createdCategory.id);
      closeQuickCategoryForm();
      toast.success("Categoría creada y seleccionada.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudo crear la categoría.",
      );
    } finally {
      setIsCreatingCategory(false);
    }
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setEditCategoryId(product.category_id);
    setEditName(product.name);
    setEditBrand(product.brand || "");
    setEditDescription(product.description || "");
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !editingProduct) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    if (!editCategoryId) {
      toast.error("Selecciona una categoría.");

      return;
    }

    const payload: ProductUpdateRequest = {
      category_id: editCategoryId,
      name: editName,
      brand: editBrand || null,
      description: editDescription || null,
    };

    try {
      setIsUpdatingProduct(true);

      const updatedProduct = await productService.updateProduct(
        editingProduct.id,
        payload,
        token,
      );

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === updatedProduct.id
            ? updatedProduct
            : currentProduct,
        ),
      );
      setEditingProduct(null);

      toast.success("Producto actualizado correctamente.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo actualizar el producto.";

      toast.error(message);
    } finally {
      setIsUpdatingProduct(false);
    }
  }

  async function handleToggleProduct(product: Product) {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    const nextIsActive = !product.is_active;

    try {
      setUpdatingProductId(product.id);

      const updatedProduct = await productService.updateProduct(
        product.id,
        {
          is_active: nextIsActive,
          status: nextIsActive ? "ACTIVE" : "INACTIVE",
        },
        token,
      );

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === updatedProduct.id
            ? updatedProduct
            : currentProduct,
        ),
      );

      toast.success(
        nextIsActive ? "Producto activado." : "Producto desactivado.",
      );
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo actualizar el estado del producto.";

      toast.error(message);
    } finally {
      setUpdatingProductId(null);
    }
  }

  return (
    <AppShell
      title="Productos"
      description="Gestiona los productos base del catálogo Kadosh."
    >
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Productos registrados
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              {products.length} producto{products.length === 1 ? "" : "s"} en
              el catálogo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Link
                className={cn(buttonVariants({ variant: "outline" }))}
                href="/products/categories"
              >
                <FolderCog className="h-4 w-4" />
                Gestionar categorías
              </Link>
            ) : null}
            <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
            <Input placeholder="Buscar por nombre, marca o descripción" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <select className="h-10 rounded-md border bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando productos...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
              Todavía no hay productos registrados.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  isUpdating={updatingProductId === product.id}
                  product={product}
                  onEdit={() => openEditDialog(product)}
                  onToggle={() => void handleToggleProduct(product)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) closeQuickCategoryForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="category">Categoría</Label>
                {isAdmin && !isQuickCategoryOpen ? (
                  <Button
                    className="h-auto px-0 py-0 text-xs"
                    type="button"
                    variant="link"
                    disabled={isSubmitting}
                    onClick={() => setIsQuickCategoryOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear categoría
                  </Button>
                ) : null}
              </div>
              <select
                id="category"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={categoryId}
                disabled={
                  isSubmitting ||
                  isCreatingCategory ||
                  activeCategories.length === 0
                }
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                {activeCategories.length === 0 ? (
                  <option value="">No hay categorías disponibles</option>
                ) : null}
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {isQuickCategoryOpen ? (
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Nueva categoría</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Se seleccionará automáticamente al crearla.
                    </p>
                  </div>
                  <Button
                    aria-label="Cerrar creación de categoría"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    disabled={isCreatingCategory}
                    onClick={closeQuickCategoryForm}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="quickCategoryName">Nombre</Label>
                    <Input
                      id="quickCategoryName"
                      maxLength={100}
                      placeholder="Ej. Camisas"
                      value={quickCategoryName}
                      disabled={isCreatingCategory}
                      onChange={(event) =>
                        setQuickCategoryName(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quickCategoryDescription">
                      Descripción{" "}
                      <span className="font-normal text-slate-400">
                        (opcional)
                      </span>
                    </Label>
                    <Textarea
                      id="quickCategoryDescription"
                      className="min-h-18"
                      maxLength={300}
                      placeholder="Qué productos pertenecen a esta categoría."
                      value={quickCategoryDescription}
                      disabled={isCreatingCategory}
                      onChange={(event) =>
                        setQuickCategoryDescription(event.target.value)
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      disabled={isCreatingCategory}
                      onClick={closeQuickCategoryForm}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      disabled={
                        isCreatingCategory || !quickCategoryName.trim()
                      }
                      onClick={() => void handleQuickCategorySubmit()}
                    >
                      {isCreatingCategory ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Crear y seleccionar
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Polera Oversize Kadosh"
                value={name}
                disabled={isSubmitting}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                placeholder="Kadosh"
                value={brand}
                disabled={isSubmitting}
                onChange={(event) => setBrand(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Producto urbano de temporada."
                value={description}
                disabled={isSubmitting}
                onChange={(event) => setDescription(event.target.value)}
              />
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
              <Button
                type="submit"
                disabled={
                  isSubmitting || isCreatingCategory || isQuickCategoryOpen
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear producto"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingProduct !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingProduct(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleEditSubmit}>
            <div className="space-y-2">
              <Label htmlFor="editCategory">Categoría</Label>
              <select
                id="editCategory"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editCategoryId}
                disabled={isUpdatingProduct || categories.length === 0}
                onChange={(event) => setEditCategoryId(event.target.value)}
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}{category.is_active ? "" : " (Inactiva)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editName">Nombre</Label>
              <Input
                id="editName"
                value={editName}
                disabled={isUpdatingProduct}
                onChange={(event) => setEditName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editBrand">Marca</Label>
              <Input
                id="editBrand"
                value={editBrand}
                disabled={isUpdatingProduct}
                onChange={(event) => setEditBrand(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Descripción</Label>
              <Input
                id="editDescription"
                value={editDescription}
                disabled={isUpdatingProduct}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isUpdatingProduct}
                onClick={() => setEditingProduct(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdatingProduct}>
                {isUpdatingProduct ? (
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
    </AppShell>
  );
}

function ProductCard({
  isUpdating,
  product,
  onEdit,
  onToggle,
}: {
  isUpdating: boolean;
  product: Product;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="flex min-h-48 flex-col justify-between rounded-xl border bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950">{product.name}</p>
            <p className="text-sm text-slate-500">
              {product.brand || "Sin marca"}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(product.status)}>
            {product.is_active ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        <p className="line-clamp-3 text-sm text-slate-600">
          {product.description || "Sin descripción registrada."}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Estado
          </p>
          <p className="text-sm text-slate-600">
            {product.is_active ? "Visible para venta" : "Oculto en Caja"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <button
            aria-checked={product.is_active}
            aria-label={
              product.is_active ? "Desactivar producto" : "Activar producto"
            }
            className={`relative h-6 w-11 rounded-full transition ${
              product.is_active ? "bg-slate-950" : "bg-slate-300"
            }`}
            disabled={isUpdating}
            role="switch"
            type="button"
            onClick={onToggle}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                product.is_active ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>
    </article>
  );
}
