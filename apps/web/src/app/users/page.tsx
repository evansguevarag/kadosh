"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, LoadingState } from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/use-auth";
import { userService } from "@/features/users/user-service";
import { ApiClientError } from "@/services/api-client";
import type { ManagedUser, UserRole } from "@/types/api";

type UserForm = {
  first_name: string; paternal_last_name: string; maternal_last_name: string;
  email: string; password: string;
  document_number: string; phone: string; role: UserRole;
};
const EMPTY_FORM: UserForm = { first_name: "", paternal_last_name: "", maternal_last_name: "", email: "", password: "", document_number: "", phone: "", role: "EMPLOYEE" };

export default function UsersPage() {
  const { token, user, status } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role_name === "ADMIN";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    try { setLoading(true); setUsers(await userService.list(token)); }
    catch (error) { toast.error(error instanceof ApiClientError ? error.message : "No se pudieron cargar los usuarios."); }
    finally { setLoading(false); }
  }, [isAdmin, token]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isAdmin, load, status]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    return users.filter((item) => !value || `${item.first_name} ${item.paternal_last_name} ${item.maternal_last_name ?? ""} ${item.email} ${item.document_number ?? ""}`.toLowerCase().includes(value));
  }, [search, users]);

  function openCreate() { setForm(EMPTY_FORM); setCreateOpen(true); }
  function openEdit(item: ManagedUser) {
    setForm({ first_name: item.first_name, paternal_last_name: item.paternal_last_name, maternal_last_name: item.maternal_last_name ?? "", email: item.email, password: "", document_number: item.document_number ?? "", phone: item.phone ?? "", role: item.role });
    setEditing(item);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (form.document_number && !/^\d{8}$/.test(form.document_number)) { toast.error("El DNI debe tener exactamente 8 dígitos."); return; }
    if (form.phone && !/^9\d{8}$/.test(form.phone)) { toast.error("El celular debe empezar con 9 y tener 9 dígitos."); return; }
    try {
      setSaving(true);
      const payload = { ...form };
      if (editing) {
        await userService.update(editing.id, { ...payload, password: form.password || undefined }, token);
        setEditing(null); toast.success("Usuario actualizado correctamente.");
      } else {
        await userService.create(payload, token); setCreateOpen(false); toast.success("Usuario creado correctamente.");
      }
      await load();
    } catch (error) { toast.error(error instanceof ApiClientError ? error.message : "No se pudo guardar el usuario."); }
    finally { setSaving(false); }
  }

  async function toggle(item: ManagedUser) {
    if (!token) return;
    try { await userService.update(item.id, { is_active: !item.is_active }, token); toast.success(item.is_active ? "Usuario desactivado." : "Usuario activado."); await load(); }
    catch (error) { toast.error(error instanceof ApiClientError ? error.message : "No se pudo cambiar el estado."); }
  }

  if (status === "authenticated" && !isAdmin) return <AppShell title="Acceso restringido" description="Esta sección está reservada para administración."><EmptyState title="Sin permisos" description="Tu cuenta no puede administrar usuarios." /></AppShell>;

  return <AppShell title="Usuarios" description="Administra las cuentas y responsabilidades del equipo Kadosh.">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-base font-semibold"><UserCog className="h-5 w-5" />Personal registrado</h2><p className="mt-1 text-sm text-slate-500">Las cuentas desactivadas conservan su historial y pierden el acceso inmediatamente.</p></div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Nuevo usuario</Button>
      </div>
      <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nombre, correo o DNI" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {loading ? <LoadingState label="Cargando usuarios..." rows={4} /> : filtered.length === 0 ? <EmptyState title="No se encontraron usuarios" description="Prueba con otro dato de búsqueda." /> :
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article key={item.id} className="flex min-h-52 flex-col rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{item.first_name} {item.paternal_last_name} {item.maternal_last_name ?? ""}</h3><p className="mt-1 break-all text-sm text-slate-500">{item.email}</p></div><Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "Activo" : "Inactivo"}</Badge></div>
          <div className="mt-4 space-y-2 border-y py-3 text-sm"><p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" />{item.role === "ADMIN" ? "Administrador" : "Empleado"}</p><p className="text-slate-500">DNI: {item.document_number || "No registrado"}</p><p className="text-slate-500">Celular: {item.phone || "No registrado"}</p></div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4"><Button variant="outline" size="sm" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" />Editar</Button><Button variant="outline" size="sm" disabled={item.id === user?.id} onClick={() => void toggle(item)}>{item.is_active ? "Desactivar" : "Activar"}</Button></div>
        </article>)}</div>}
    </div>
    <UserDialog open={createOpen || editing !== null} editing={editing !== null} form={form} saving={saving} onChange={setForm} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }} onSubmit={submit} />
  </AppShell>;
}

function UserDialog({ open, editing, form, saving, onChange, onOpenChange, onSubmit }: { open: boolean; editing: boolean; form: UserForm; saving: boolean; onChange: (value: UserForm) => void; onOpenChange: (open: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog
    open={open}
    disablePointerDismissal
    onOpenChange={(nextOpen) => {
      if (nextOpen) onOpenChange(true);
    }}
  ><DialogContent className="sm:max-w-2xl" showCloseButton={false}><DialogHeader><DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle><DialogDescription>Asigna los datos de acceso y el nivel de responsabilidad dentro del sistema.</DialogDescription></DialogHeader>
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
      <Field label="Nombres"><Input value={form.first_name} maxLength={100} onChange={(e) => onChange({ ...form, first_name: e.target.value })} required /></Field>
      <Field label="Apellido paterno"><Input value={form.paternal_last_name} maxLength={100} onChange={(e) => onChange({ ...form, paternal_last_name: e.target.value })} required /></Field>
      <Field label="Apellido materno"><Input value={form.maternal_last_name} maxLength={100} onChange={(e) => onChange({ ...form, maternal_last_name: e.target.value })} required /></Field>
      <Field label="Correo"><Input type="email" value={form.email} onChange={(e) => onChange({ ...form, email: e.target.value })} required /></Field>
      <Field label={editing ? "Nueva contraseña (opcional)" : "Contraseña temporal"}><Input type="password" minLength={8} value={form.password} onChange={(e) => onChange({ ...form, password: e.target.value })} required={!editing} /></Field>
      <Field label="DNI"><Input inputMode="numeric" minLength={8} maxLength={8} value={form.document_number} onChange={(e) => onChange({ ...form, document_number: e.target.value.replace(/\D/g, "") })} required /></Field>
      <Field label="Celular"><Input inputMode="numeric" minLength={9} maxLength={9} value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value.replace(/\D/g, "") })} required /></Field>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="user-role">Rol</Label><select id="user-role" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.role} onChange={(e) => onChange({ ...form, role: e.target.value as UserRole })}><option value="EMPLOYEE">Empleado: vende, cobra y atiende operaciones</option><option value="ADMIN">Administrador: configuración y acceso completo</option></select></div>
      <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? "Guardar cambios" : "Crear usuario"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
