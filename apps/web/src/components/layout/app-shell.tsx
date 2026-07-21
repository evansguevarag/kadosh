"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MonitorSmartphone,
  Package,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShoppingBag,
  ShoppingCart,
  Users,
  UserCog,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  first_name?: string | null;
  paternal_last_name?: string | null;
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
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Caja",
    href: "/pos",
    icon: ShoppingCart,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Ventas",
    href: "/sales",
    icon: ReceiptText,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Cambios y devoluciones",
    href: "/returns",
    icon: RefreshCcw,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Productos",
    href: "/products",
    icon: Package,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Catálogo",
    href: "/product-variants",
    icon: Boxes,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Inventario",
    href: "/inventory",
    icon: PackageSearch,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Clientes",
    href: "/customers",
    icon: Users,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Pagos",
    href: "/payments",
    icon: CreditCard,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Pantallas cliente",
    href: "/customer-displays",
    icon: MonitorSmartphone,
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    label: "Reportes",
    href: "/reports",
    icon: BarChart3,
    roles: ["ADMIN"],
  },
  {
    label: "Usuarios",
    href: "/users",
    icon: UserCog,
    roles: ["ADMIN"],
  },
];

function formatRole(roleName?: string | null) {
  if (!roleName) {
    return "Rol no disponible";
  }

  const normalizedRole = roleName.toUpperCase();

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    EMPLOYEE: "Empleado",
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
  const headerName = [
    authUser?.first_name?.trim().split(/\s+/)[0],
    authUser?.paternal_last_name,
  ].filter(Boolean).join(" ") || displayName;
  const currentRole = (authUser?.role_name || authUser?.role || "").toUpperCase();
  const visibleNavigationItems = navigationItems.filter((item) =>
    item.roles.includes(currentRole),
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    const adminOnlyRoutes = [
      "/products/categories",
      "/reports",
      "/users",
    ];
    const isAdminOnlyRoute = adminOnlyRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (status === "authenticated" && currentRole !== "ADMIN" && isAdminOnlyRoute) {
      router.replace("/dashboard");
    }
  }, [currentRole, pathname, router, status]);

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
      <aside className="fixed left-0 top-0 hidden h-screen w-60 flex-col border-r bg-white px-4 py-5 print:hidden lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
            <ShoppingBag className="h-5 w-5" />
          </div>

          <div>
            <p className="text-base font-bold leading-none">Kadosh</p>
            <p className="mt-1 text-xs text-slate-500">Tienda urbana</p>
          </div>
        </div>

        <nav className="mt-7 min-h-0 flex-1 space-y-1 overflow-y-auto pb-4">
          {visibleNavigationItems.map((item) => {
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

      </aside>

      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent
          className="inset-y-0 left-0 flex h-[100dvh] max-h-none w-[min(88vw,20rem)] max-w-none -translate-x-0 -translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-white p-0 lg:hidden"
          showCloseButton
        >
          <DialogTitle className="sr-only">Navegación principal</DialogTitle>
          <div className="flex min-h-0 w-full flex-1 flex-col bg-white">
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
              {visibleNavigationItems.map((item) => {
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

            <Button
              type="button"
              variant="destructive"
              onClick={confirmLogout}
            >
              Sí, cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="print:pl-0 lg:pl-60">
        <header className="sticky top-0 z-20 border-b bg-white/95 px-3 py-3 backdrop-blur print:hidden sm:px-5 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
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
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Abrir menú de usuario"
                className="group flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:gap-3 sm:px-2"
              >
                <div className="hidden min-w-0 text-right sm:block">
                  <p className="max-w-48 truncate text-sm text-slate-600">
                    Hola, <span className="font-semibold text-slate-950">{headerName}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{displayRole}</p>
                </div>
                <span className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
                  <UserRound className="size-5" />
                </span>
                <ChevronDown className="hidden size-4 text-slate-600 transition-transform group-data-[popup-open]:rotate-180 sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" sideOffset={8}>
                <DropdownMenuItem
                  className="min-h-10 gap-2 px-2.5"
                  onClick={requestLogout}
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 px-3 py-4 print:p-0 sm:px-5 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}


