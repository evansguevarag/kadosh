import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Boxes,
  CreditCard,
  Database,
  LockKeyhole,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  TabletSmartphone,
  Users,
  Zap,
} from "lucide-react";

const mainModules = [
  {
    title: "Caja y ventas",
    description:
      "Pantalla para que el vendedor registre productos, clientes, pagos y confirme ventas.",
    icon: ReceiptText,
  },
  {
    title: "Inventario por variantes",
    description:
      "Control de stock por talla, color y SKU para prendas de ropa urbana.",
    icon: Boxes,
  },
  {
    title: "Pagos con Culqi",
    description:
      "Flujo seguro para que el cliente pague desde una tablet sin mostrar su tarjeta al vendedor.",
    icon: CreditCard,
  },
  {
    title: "Reportes inteligentes",
    description:
      "Reportes de ventas, stock bajo y productos más vendidos usando pandas y numpy en el backend.",
    icon: BarChart3,
  },
];

const technicalHighlights = [
  {
    title: "Next.js + shadcn/ui",
    description: "Frontend moderno, responsive y preparado para dashboard.",
    icon: MonitorSmartphone,
  },
  {
    title: "FastAPI",
    description: "API profesional por capas con validaciones y documentación.",
    icon: Zap,
  },
  {
    title: "Supabase PostgreSQL",
    description: "Base de datos en la nube con Realtime para la tablet del cliente.",
    icon: Database,
  },
  {
    title: "Seguridad RBAC",
    description: "Roles, JWT, validaciones, hashing de contraseñas y protección de rutas.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(var(--muted)),transparent_30%)]" />

        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <ShoppingBag className="size-6" />
              </div>

              <div>
                <p className="text-lg font-bold tracking-tight">Kadosh POS</p>
                <p className="text-sm text-muted-foreground">
                  Sistema de gestión para tienda urbana
                </p>
              </div>
            </div>

            <Badge variant="secondary" className="hidden sm:inline-flex">
              Proyecto Final - Lenguajes de Programación
            </Badge>
          </header>

          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="rounded-full px-4 py-1">
                  Next.js · FastAPI · Supabase · Culqi
                </Badge>

                <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Punto de venta profesional para una tienda de ropa urbana.
                </h1>

                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  Sistema diseñado para gestionar productos, variantes por talla
                  y color, inventario, clientes, ventas, pagos seguros y
                  reportes, aplicando programación funcional, lógica y
                  multiparadigma.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="gap-2">
                  <ReceiptText className="size-5" />
                  Ir a caja
                </Button>

                <Button size="lg" variant="outline" className="gap-2">
                  <TabletSmartphone className="size-5" />
                  Pantalla del cliente
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-3xl font-bold">Realtime</p>
                  <p className="text-sm text-muted-foreground">
                    Tablet sincronizada con Supabase
                  </p>
                </div>

                <div>
                  <p className="text-3xl font-bold">RBAC</p>
                  <p className="text-sm text-muted-foreground">
                    Roles de administrador y vendedor
                  </p>
                </div>

                <div>
                  <p className="text-3xl font-bold">Culqi</p>
                  <p className="text-sm text-muted-foreground">
                    Pago seguro sin exponer tarjeta
                  </p>
                </div>
              </div>
            </div>

            <Card className="border-border/80 shadow-lg">
              <CardHeader>
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <LockKeyhole className="size-6" />
                </div>

                <CardTitle className="text-2xl">
                  Flujo seguro vendedor + tablet
                </CardTitle>

                <CardDescription>
                  El vendedor registra la venta y la tablet del cliente recibe
                  el pago automáticamente por Supabase Realtime.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Pantalla del vendedor</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Agrega productos, confirma el total y envía la sesión de
                    pago a la tablet.
                  </p>
                </div>

                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Pantalla del cliente</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    El cliente revisa el monto y paga en el formulario seguro de
                    Culqi.
                  </p>
                </div>

                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Privacidad</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    El vendedor nunca visualiza tarjeta, CVV ni fecha de
                    vencimiento.
                  </p>
                </div>

                <Separator />

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  Pensado para tienda física, exposición en clase y empresa real.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="mb-10 space-y-3">
          <Badge variant="outline">Módulos principales</Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            Funcionalidades del sistema
          </h2>
          <p className="max-w-3xl text-muted-foreground">
            El sistema no copia el modelo académico tal cual: lo mejora con
            variantes, movimientos de inventario, pagos, auditoría y reportes.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {mainModules.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.title}>
                <CardHeader>
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="mb-10 space-y-3">
            <Badge variant="outline">Tecnologías y seguridad</Badge>
            <h2 className="text-3xl font-bold tracking-tight">
              Arquitectura preparada para el proyecto final
            </h2>
            <p className="max-w-3xl text-muted-foreground">
              La estructura permitirá demostrar programación funcional,
              programación lógica, programación multiparadigma, clases,
              herencia, módulos, pandas, numpy y seguridad del sistema.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {technicalHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="bg-background">
                  <CardHeader>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
