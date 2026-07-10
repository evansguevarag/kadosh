"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/use-auth";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({ email, password });
      toast.success("Inicio de sesión correcto.");
      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo iniciar sesión.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            <ShoppingBag className="h-4 w-4" />
            Kadosh
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Sistema profesional para ventas, stock y pagos de Kadosh.
            </h1>

            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Gestiona productos, presentaciones por talla y color, inventario,
              clientes, ventas, pagos manuales, Culqi y reportes desde una sola
              plataforma.
            </p>
          </div>

          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">JWT</p>
              <p>Autenticación segura</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">RBAC</p>
              <p>Roles y permisos</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">Caja</p>
              <p>Ventas en tienda</p>
            </div>
          </div>
        </section>

        <Card className="border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <LockKeyhole className="h-6 w-6" />
            </div>

            <div>
              <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
              <CardDescription>
                Ingresa con tu usuario administrador o vendedor.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  autoComplete="username"
                  type="email"
                  placeholder="correo@kadosh.com"
                  value={email}
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    autoComplete="current-password"
                    className="pr-10"
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    disabled={isSubmitting}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <Button
                    aria-label={
                      isPasswordVisible
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    className="absolute right-1 top-1 h-8 w-8"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "h-auto px-0 text-sm",
                  )}
                  href="/forgot-password"
                  target="_blank"
                  rel="noreferrer"
                >
                  Olvidé mi contraseña
                </Link>
              </div>

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Entrar al sistema"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
