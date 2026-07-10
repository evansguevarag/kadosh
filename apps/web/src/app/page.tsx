import Link from "next/link";
import {
  ArrowRight,
  LockKeyhole,
  MonitorSmartphone,
  ShoppingBag,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
            <ShoppingBag className="h-8 w-8" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
            Kadosh
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Sistema de ventas para tienda urbana
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Elige cómo deseas usar el sistema. La PC o laptop de caja ingresa al
            panel administrativo, mientras que la tablet funciona como pantalla
            cliente para revisar y pagar compras.
          </p>
        </div>

        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
          <Card className="border-slate-200 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-2xl">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <LockKeyhole className="h-6 w-6" />
              </div>

              <CardTitle className="text-2xl">Ingresar al sistema</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="leading-7 text-slate-600">
                Acceso para administrador, cajero o vendedor. Desde aquí puedes
                gestionar productos, inventario, clientes, ventas, pagos y
                reportes.
              </p>

              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-medium text-white transition hover:bg-slate-800"
              >
                Ir al login
                <ArrowRight className="h-5 w-5" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-2xl">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <MonitorSmartphone className="h-6 w-6" />
              </div>

              <CardTitle className="text-2xl">
                Usar como pantalla cliente
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="leading-7 text-slate-600">
                Modo para tablet. El cliente podrá visualizar el monto enviado
                desde caja y realizar el pago desde una pantalla separada.
              </p>

              <Link
                href="/customer-display/pair"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-950 transition hover:bg-slate-100"
              >
                Configurar tablet
                <ArrowRight className="h-5 w-5" />
              </Link>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Una sola URL para producción: caja y tablet eligen su modo de uso.
        </p>
      </section>
    </main>
  );
}
