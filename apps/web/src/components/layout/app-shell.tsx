"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MonitorSmartphone,
  Package,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/use-auth";

type AppShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

type AuthUserWithProfile = {
  full_name?: string | null;
  email?: string | null;
  role_name?: string | null;
  role?: string | null;
};

const navigationItems = [
  {
    label: "Panel",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Caja",
    href: "/pos",
    icon: ShoppingCart,
  },
  {
    label: "Ventas",
    href: "/sales",
    icon: ReceiptText,
  },
  {
    label: "Productos",
    href: "/products",
    icon: Package,
  },
  {
    label: "Catálogo",
    href: "/product-variants",
    icon: Boxes,
  },
  {
    label: "Inventario",
    href: "/inventory",
    icon: PackageSearch,
  },
  {
    label: "Clientes",
    href: "/customers",
    icon: Users,
  },
  {
    label: "Pagos",
    href: "/payments",
    icon: CreditCard,
  },
  {
    label: "Pantallas cliente",
    href: "/customer-displays",
    icon: MonitorSmartphone,
  },
  {
    label: "Reportes",
    href: "/reports",
    icon: BarChart3,
  },
];

function formatRole(roleName?: string | null) {
  if (!roleName) {
    return "Rol no disponible";
  }

  const normalizedRole = roleName.toUpperCase();

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    SELLER: "Vendedor",
    CASHIER: "Cajero",
  };

  return roleLabels[normalizedRole] ?? normalizedRole;
}

export function AppShell({ title, description, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, status } = useAuth();

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const authUser = user as AuthUserWithProfile | null;

  const displayName =
    authUser?.full_name || authUser?.email || "Usuario Kadosh";
  const displayRole = formatRole(authUser?.role_name || authUser?.role);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  function confirmLogout() {
    logout();
    setIsLogoutDialogOpen(false);
    router.push("/login");
  }

  function requestLogout() {
    setIsMobileMenuOpen(false);
    setIsLogoutDialogOpen(true);
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Validando sesión...
        </div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed left-0 top-0 hidden h-screen w-60 border-r bg-white px-4 py-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
            <ShoppingBag className="h-5 w-5" />
          </div>

          <div>
            <p className="text-base font-bold leading-none">Kadosh</p>
            <p className="mt-1 text-xs text-slate-500">Tienda urbana</p>
          </div>
        </div>

        <nav className="mt-7 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 rounded-xl border bg-slate-50 p-3 text-center">
          <p className="truncate text-sm font-bold">{displayName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{displayRole}</p>

          <Button
            className="mt-3 h-8 w-full text-xs"
            variant="outline"
            size="sm"
            type="button"
            onClick={requestLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent
          className="inset-y-0 left-0 h-[100dvh] max-h-none w-[min(88vw,20rem)] max-w-none -translate-x-0 -translate-y-0 content-start gap-0 overflow-hidden rounded-none p-0 lg:hidden"
          showCloseButton
        >
          <DialogTitle className="sr-only">Navegación principal</DialogTitle>
          <div className="flex h-full min-h-0 flex-col bg-white">
            <div className="flex items-center gap-3 border-b px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold leading-none">Kadosh</p>
                <p className="mt-1 text-xs text-slate-500">Tienda urbana</p>
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t bg-slate-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <p className="truncate text-sm font-bold">{displayName}</p>
              <p className="mt-0.5 text-xs text-slate-500">{displayRole}</p>
              <Button
                className="mt-3 w-full"
                variant="outline"
                size="sm"
                type="button"
                onClick={requestLogout}
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Se cerrará tu sesión actual y volverás a la pantalla de login.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsLogoutDialogOpen(false)}
            >
              Cancelar
            </Button>

            <Button type="button" onClick={confirmLogout}>
              Sí, cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b bg-white/95 px-3 py-3 backdrop-blur sm:px-5 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              aria-label="Abrir menú principal"
              className="mt-0.5 lg:hidden"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold tracking-tight sm:text-2xl">
                {title}
              </h1>
              <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">
                {description}
              </p>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}


