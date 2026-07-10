"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerDisplayDeviceService } from "@/features/payments/customer-display-device-service";
import { ApiClientError } from "@/services/api-client";

const DEVICE_ID_STORAGE_KEY = "kadosh_customer_display_device_id";
const DEVICE_TOKEN_STORAGE_KEY = "kadosh_customer_display_device_token";
const DEVICE_NAME_STORAGE_KEY = "kadosh_customer_display_device_name";

export default function PairCustomerDisplayPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      toast.error("El código debe tener exactamente 6 dígitos.");

      return;
    }

    try {
      setIsPairing(true);

      const response = await customerDisplayDeviceService.pairDevice({
        code,
      });

      window.localStorage.setItem(
        DEVICE_ID_STORAGE_KEY,
        response.device_id,
      );
      window.localStorage.setItem(
        DEVICE_TOKEN_STORAGE_KEY,
        response.device_token,
      );
      window.localStorage.setItem(
        DEVICE_NAME_STORAGE_KEY,
        response.device_name,
      );

      toast.success("Tablet vinculada correctamente.");
      router.push("/customer-display");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo vincular la tablet.";

      toast.error(message);
    } finally {
      setIsPairing(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
            <MonitorSmartphone className="h-8 w-8" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
            Kadosh
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Vincular tablet
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">
            Ingresa el código generado desde la PC de caja en el módulo
            Pantallas cliente. El código dura pocos minutos por seguridad.
          </p>
        </div>

        <Card className="w-full border-slate-200 shadow-2xl shadow-slate-200/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-6 w-6" />
              Código de vinculación
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="code">Código de 6 dígitos</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="482913"
                  value={code}
                  disabled={isPairing}
                  className="h-16 text-center text-3xl font-bold tracking-[0.35em]"
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                />
              </div>

              <Button className="h-12 w-full text-base" type="submit" disabled={isPairing}>
                {isPairing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  "Vincular tablet"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-base"
                disabled={isPairing}
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="h-5 w-5" />
                Volver al inicio
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
