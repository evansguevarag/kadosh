"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FolderCog,
  Loader2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/async-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/use-auth";
import { productService } from "@/features/products/product-service";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import type { ManagedCategory } from "@/types/api";

type CategoryFormState = {
  name: string;
  description: string;
};

const EMPTY_FORM: CategoryFormState = { name: "", description: "" };

export default function ProductCategoriesPage() {
  const router = useRouter();
  const { isAuthenticated, token, user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role_name === "ADMIN";

  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ManagedCategory | null>(null);
  const [pendingToggle, setPendingToggle] = useState<ManagedCategory | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  const filteredCategories = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? category.is_active : !category.is_active);
      const matchesSearch =
        !search ||
        category.name.toLowerCase().includes(search) ||
        category.description?.toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [categories, searchTerm, statusFilter]);

  const loadCategories = useCallback(async () => {
    if (!token || !isAdmin) return;

    try {
      setIsLoading(true);
      setCategories(await productService.listManagedCategories(token));
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron cargar las categorías.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (user && !isAdmin) {
      toast.error("Solo un administrador puede gestionar categorías.");
      router.replace("/products");
      return;
    }

    if (!isAdmin) return;

    const timeoutId = window.setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAdmin, isAuthenticated, loadCategories, router, user]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setIsCreateOpen(true);
  }

  function openEdit(category: ManagedCategory) {
    setForm({
      name: category.name,
      description: category.description ?? "",
    });
    setEditingCategory(category);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !form.name.trim()) return;

    try {
      setIsSaving(true);
      await productService.createCategory(
        {
          name: form.name.trim(),
          description: form.description.trim() || null,
        },
        token,
      );
      setIsCreateOpen(false);
      toast.success("Categoría creada correctamente.");
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudo crear la categoría.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editingCategory || !form.name.trim()) return;

    try {
      setIsSaving(true);
      await productService.updateCategory(
        editingCategory.id,
        {
          name: form.name.trim(),
          description: form.description.trim() || null,
        },
        token,
      );
      setEditingCategory(null);
      toast.success("Categoría actualizada correctamente.");
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudo actualizar la categoría.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmToggle() {
    if (!token || !pendingToggle) return;

    try {
      setIsSaving(true);
      const nextIsActive = !pendingToggle.is_active;
      await productService.updateCategory(
        pendingToggle.id,
        { is_active: nextIsActive },
        token,
      );
      setPendingToggle(null);
      toast.success(nextIsActive ? "Categoría activada." : "Categoría desactivada.");
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cambiar el estado de la categoría.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      title="Categorías"
      description="Organiza las familias de productos disponibles en el catálogo."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className={cn(buttonVariants({ variant: "outline" }))} href="/products">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Link>
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva categoría
          </Button>
        </div>

        <section>
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <FolderCog className="h-5 w-5" />
              Categorías del catálogo
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Las categorías inactivas se conservan en productos históricos, pero no se ofrecen al crear productos nuevos.
            </p>
          </div>

          <div className="mb-4 grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-[1fr_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o descripción"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <select
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activas</option>
              <option value="INACTIVE">Inactivas</option>
            </select>
          </div>

          {isLoading ? (
            <LoadingState label="Cargando categorías..." rows={5} />
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              title={categories.length === 0 ? "Todavía no hay categorías" : "No se encontraron coincidencias"}
              description={categories.length === 0 ? "Crea la primera categoría para comenzar a registrar productos." : "Prueba con otro nombre o estado."}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => (
                <article
                  key={category.id}
                  className="flex min-h-56 flex-col rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-slate-400">
                        Categoría
                      </p>
                      <h3 className="mt-1 break-words text-base font-semibold text-slate-950">
                        {category.name}
                      </h3>
                    </div>
                    <Badge className="shrink-0" variant={category.is_active ? "default" : "outline"}>
                      {category.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>

                  <p className="mt-3 line-clamp-3 min-h-15 text-sm leading-5 text-slate-500">
                    {category.description || "Sin descripción registrada."}
                  </p>

                  <div className="mt-4 border-y bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">Productos asociados</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-950">
                      {category.product_count}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <Button variant="outline" size="sm" type="button" onClick={() => openEdit(category)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        Disponible
                      </span>
                      <button
                        aria-checked={category.is_active}
                        aria-label={category.is_active ? `Desactivar ${category.name}` : `Activar ${category.name}`}
                        className={`relative h-6 w-11 rounded-full transition ${category.is_active ? "bg-slate-950" : "bg-slate-300"}`}
                        role="switch"
                        type="button"
                        onClick={() => setPendingToggle(category)}
                      >
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${category.is_active ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <CategoryFormDialog
        description="La nueva categoría quedará disponible inmediatamente al crear productos."
        form={form}
        isOpen={isCreateOpen}
        isSaving={isSaving}
        submitLabel="Crear categoría"
        title="Nueva categoría"
        onFormChange={setForm}
        onOpenChange={setIsCreateOpen}
        onSubmit={submitCreate}
      />
      <CategoryFormDialog
        description="Los productos asociados conservarán esta categoría."
        form={form}
        isOpen={editingCategory !== null}
        isSaving={isSaving}
        submitLabel="Guardar cambios"
        title="Editar categoría"
        onFormChange={setForm}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        onSubmit={submitEdit}
      />

      <Dialog open={pendingToggle !== null} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingToggle?.is_active ? "¿Desactivar categoría?" : "¿Activar categoría?"}</DialogTitle>
            <DialogDescription>
              {pendingToggle?.is_active
                ? `“${pendingToggle.name}” tiene ${pendingToggle.product_count} producto${pendingToggle.product_count === 1 ? "" : "s"} asociado${pendingToggle.product_count === 1 ? "" : "s"}. Dejará de aparecer en productos nuevos, pero no se eliminará del historial.`
                : `“${pendingToggle?.name}” volverá a estar disponible al crear o editar productos.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={isSaving} onClick={() => setPendingToggle(null)}>Cancelar</Button>
            <Button type="button" disabled={isSaving} onClick={() => void confirmToggle()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pendingToggle?.is_active ? "Desactivar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CategoryFormDialog({
  description,
  form,
  isOpen,
  isSaving,
  submitLabel,
  title,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  description: string;
  form: CategoryFormState;
  isOpen: boolean;
  isSaving: boolean;
  submitLabel: string;
  title: string;
  onFormChange: (form: CategoryFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${title}-name`}>Nombre</Label>
            <Input
              id={`${title}-name`}
              maxLength={100}
              placeholder="Ej. Camisas"
              value={form.name}
              disabled={isSaving}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${title}-description`}>Descripción <span className="font-normal text-slate-400">(opcional)</span></Label>
            <Textarea
              id={`${title}-description`}
              maxLength={300}
              placeholder="Describe qué productos pertenecen a esta categoría."
              value={form.description}
              disabled={isSaving}
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving || !form.name.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
