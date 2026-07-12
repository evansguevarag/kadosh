"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
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
import { authService } from "@/features/auth/auth-service";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";

type PasswordResetStep = "email" | "otp" | "password";

const stepLabels: Record<PasswordResetStep, string> = {
  email: "Enviar código",
  otp: "Validar código",
  password: "Nueva contraseña",
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [resetStep, setResetStep] = useState<PasswordResetStep>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      if (resetStep === "email") {
        const response = await authService.requestPasswordReset({ email });

        toast.success(response.message);

        if (!response.email_delivery_configured) {
          toast.info(
            "SMTP todavía no está configurado. Revisa la consola del backend en desarrollo.",
          );
        }

        setResetStep("otp");

        return;
      }

      if (resetStep === "otp") {
        const response = await authService.verifyPasswordResetOtp({
          email,
          otp_code: otpCode,
        });

        toast.success(response.message);
        setResetStep("password");

        return;
      }

      const response = await authService.confirmPasswordReset({
        email,
        otp_code: otpCode,
        new_password: newPassword,
      });

      toast.success(response.message);
      router.replace("/login");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo completar la recuperación.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-3 pb-6 pt-20 text-slate-950 sm:px-6 sm:py-10">
      <Link
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "absolute left-5 top-5 text-slate-600 sm:left-8 sm:top-8",
        )}
        href="/login"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al login
      </Link>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] min-w-0 max-w-md flex-col justify-center">
        <Card className="min-w-0 border-slate-200 bg-white shadow-xl shadow-slate-200/70 sm:shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <LockKeyhole className="h-6 w-6" />
            </div>

            <div>
              <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
              <CardDescription>
                Recibe un código de 6 dígitos y crea una nueva contraseña.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-5 grid grid-cols-3 gap-2 text-xs">
              {(["email", "otp", "password"] as const).map((step) => (
                <div
                  key={step}
                  className={`rounded-lg border px-2 py-2 text-center ${
                    resetStep === step
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <span className="sm:hidden">
                    {step === "email"
                      ? "Enviar"
                      : step === "otp"
                        ? "Validar"
                        : "Cambiar"}
                  </span>
                  <span className="hidden sm:inline">{stepLabels[step]}</span>
                </div>
              ))}
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    autoComplete="username"
                    className="pl-9"
                    disabled={isSubmitting || resetStep !== "email"}
                    placeholder="correo@kadosh.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              {resetStep !== "email" ? (
                <div className="space-y-2">
                  <Label htmlFor="otpCode">Código OTP</Label>
                  <Input
                    id="otpCode"
                    autoComplete="one-time-code"
                    disabled={isSubmitting || resetStep === "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    required
                  />
                </div>
              ) : null}

              {resetStep === "password" ? (
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      autoComplete="new-password"
                      className="pr-10"
                      disabled={isSubmitting}
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      type={isNewPasswordVisible ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                    <Button
                      aria-label={
                        isNewPasswordVisible
                          ? "Ocultar nueva contraseña"
                          : "Mostrar nueva contraseña"
                      }
                      className="absolute inset-y-0 right-0.5 my-auto"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setIsNewPasswordVisible((current) => !current)
                      }
                    >
                      {isNewPasswordVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : resetStep === "email" ? (
                  <>
                    <Mail className="h-4 w-4" />
                    Enviar código
                  </>
                ) : resetStep === "otp" ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Validar código
                  </>
                ) : (
                  "Cambiar contraseña"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
