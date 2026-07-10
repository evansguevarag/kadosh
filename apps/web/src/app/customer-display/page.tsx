"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Printer,
  RefreshCcw,
  ShoppingBag,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/config/env";
import {
  customerDisplayDeviceService,
  type CustomerDisplayDeviceStatusResponse,
} from "@/features/payments/customer-display-device-service";
import { customerDisplayService } from "@/features/payments/customer-display-service";
import { formatStatus } from "@/lib/status-format";
import { culqiService } from "@/features/payments/culqi-service";
import { ApiClientError } from "@/services/api-client";
import type { PaymentSession, Sale } from "@/types/api";

const DEVICE_ID_STORAGE_KEY = "kadosh_customer_display_device_id";
const DEVICE_TOKEN_STORAGE_KEY = "kadosh_customer_display_device_token";
const DEVICE_NAME_STORAGE_KEY = "kadosh_customer_display_device_name";
const POLLING_INTERVAL_MS = 3000;
const CULQI_FALLBACK_EMAIL = "cliente@kadoshpos.com";

type DisplayConnectionStatus = "initializing" | "online" | "reconnecting";

type DeviceCredentials = {
  deviceId: string;
  deviceToken: string;
};

type CompletedPayment = {
  saleId: string;
  paymentSessionId: string;
  amount: string;
  currency: string;
  message: string;
  receipt: Sale | null;
  paidAt: string;
};

type CulqiToken = {
  id: string;
};

type CulqiOrder = {
  id?: string;
};

type CulqiError = {
  user_message?: string;
  merchant_message?: string;
  message?: string;
};

type CulqiCheckoutInstance = {
  token?: CulqiToken;
  error?: CulqiError;
  order?: CulqiOrder;
  culqi?: () => void;
  open: () => void;
  close: () => void;
};

type CulqiCheckoutConfig = {
  settings: {
    title: string;
    currency: string;
    amount: number;
    order?: string;
    xculqirsaid?: string;
    rsapublickey?: string;
  };
  client: {
    email: string;
  };
  options: {
    lang: string;
    installments: boolean;
    modal: boolean;
    paymentMethods: {
      tarjeta: boolean;
      yape: boolean;
      billetera: boolean;
      bancaMovil: boolean;
      agente: boolean;
      cuotealo: boolean;
    };
    paymentMethodsSort: string[];
  };
  appearance: {
    theme: string;
    hiddenCulqiLogo: boolean;
    hiddenBannerContent: boolean;
    hiddenBanner: boolean;
    hiddenToolBarAmount: boolean;
    hiddenEmail: boolean;
    menuType: string;
    buttonCardPayText: string;
    defaultStyle: {
      bannerColor: string;
      buttonBackground: string;
      buttonTextColor: string;
      priceColor: string;
    };
  };
};

type CulqiCheckoutConstructor = new (
  publicKey: string,
  config: CulqiCheckoutConfig,
) => CulqiCheckoutInstance;

declare global {
  interface Window {
    CulqiCheckout?: CulqiCheckoutConstructor;
  }
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function formatDateTime(value: string | null) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value ? new Date(value) : new Date());
}

function formatItemDescription(item: Sale["items"][number]) {
  const details = [item.size, item.color].filter(Boolean).join(" / ");

  return details ? `${item.product_name} (${details})` : item.product_name;
}

function amountToCents(amount: string) {
  return Math.round(Number(amount) * 100);
}

function getCulqiEmail(email: string) {
  const trimmedEmail = email.trim();

  return trimmedEmail || CULQI_FALLBACK_EMAIL;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getStoredDeviceCredentials(): DeviceCredentials | null {
  const deviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  const deviceToken = window.localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);

  if (!deviceId || !deviceToken) {
    return null;
  }

  return {
    deviceId,
    deviceToken,
  };
}

function clearStoredDeviceCredentials(): void {
  window.localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  window.localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(DEVICE_NAME_STORAGE_KEY);
}

export default function CustomerDisplayPage() {
  const router = useRouter();

  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [deviceStatus, setDeviceStatus] =
    useState<CustomerDisplayDeviceStatusResponse | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<DisplayConnectionStatus>("initializing");
  const [isCulqiReady, setIsCulqiReady] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isRefreshingManually, setIsRefreshingManually] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [completedPayment, setCompletedPayment] =
    useState<CompletedPayment | null>(null);

  const activeSession = useMemo(() => sessions[0] ?? null, [sessions]);

  async function markSessionAsPaid(message: string, saleId: string) {
    const paidSession = activeSession;

    if (!paidSession) {
      return;
    }

    let receipt: Sale | null = null;

    if (credentials) {
      try {
        receipt = await customerDisplayService.getReceipt(
          credentials.deviceId,
          credentials.deviceToken,
          paidSession.id,
        );
      } catch {
        toast.warning("Pago aprobado. No se pudo cargar el detalle de la boleta.");
      }
    }

    setCompletedPayment({
      saleId,
      paymentSessionId: paidSession.id,
      amount: paidSession.amount,
      currency: paidSession.currency,
      message,
      receipt,
      paidAt: new Date().toISOString(),
    });
    setSessions((currentSessions) =>
      currentSessions.filter((session) => session.id !== paidSession.id),
    );
    setPaymentMessage("");
    toast.success(message);
  }

  const loadSessions = useCallback(
    async (deviceCredentials: DeviceCredentials, manual = false) => {
      try {
        if (manual) {
          setIsRefreshingManually(true);
        }

        const response = await customerDisplayService.listActiveSessions(
          deviceCredentials.deviceId,
          deviceCredentials.deviceToken,
        );
        setSessions(response);
        setConnectionStatus("online");
      } catch {
        setConnectionStatus("reconnecting");
      } finally {
        if (manual) {
          setIsRefreshingManually(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    async function initializeDevice() {
      const storedCredentials = getStoredDeviceCredentials();

      if (!storedCredentials) {
        router.push("/customer-display/pair");

        return;
      }

      try {
        setConnectionStatus("initializing");

        const validatedDevice =
          await customerDisplayDeviceService.validateDevice({
            device_id: storedCredentials.deviceId,
            device_token: storedCredentials.deviceToken,
          });

        setCredentials(storedCredentials);
        setDeviceStatus(validatedDevice);
        setConnectionStatus("online");

        window.localStorage.setItem(
          DEVICE_NAME_STORAGE_KEY,
          validatedDevice.device_name,
        );

        await loadSessions(storedCredentials);
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "La tablet no está vinculada o fue desactivada.";

        clearStoredDeviceCredentials();
        toast.error(message);
        router.push("/customer-display/pair");
      }
    }

    void initializeDevice();
  }, [loadSessions, router]);

  useEffect(() => {
    if (!credentials) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadSessions(credentials);
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [credentials, loadSessions]);

  async function handleCulqiResult(checkout: CulqiCheckoutInstance) {
    if (!activeSession) {
      toast.error("No hay una sesión de pago activa.");

      return;
    }

    if (checkout.token?.id) {
      const tokenId = checkout.token.id;

      checkout.close();
      setIsPaying(true);
      setPaymentMessage("");

      try {
        const response = await culqiService.createCharge({
          payment_session_id: activeSession.id,
          token_id: tokenId,
          email: getCulqiEmail(activeSession.receipt_email ?? ""),
        });

        await markSessionAsPaid(response.message, response.sale_id);

        if (credentials) {
          await loadSessions(credentials);
        }
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "No se pudo procesar el pago con Culqi.";

        setPaymentMessage(message);
        toast.error(message);
      } finally {
        setIsPaying(false);
      }

      return;
    }

    if (checkout.order?.id) {
      const culqiOrderId = checkout.order.id;

      checkout.close();
      setIsPaying(true);
      setPaymentMessage("Verificando el pago con Culqi...");

      try {
        let response = await culqiService.confirmOrder({
          payment_session_id: activeSession.id,
          culqi_order_id: culqiOrderId,
        });

        for (let attempt = 1; response.status !== "PAID" && attempt < 6; attempt += 1) {
          await wait(4000);
          response = await culqiService.confirmOrder({
            payment_session_id: activeSession.id,
            culqi_order_id: culqiOrderId,
          });
        }

        setPaymentMessage(response.message);

        if (response.status === "PAID") {
          await markSessionAsPaid(response.message, response.sale_id);
        } else {
          toast.info(response.message);
        }

        if (credentials) {
          await loadSessions(credentials);
        }
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "No se pudo confirmar el pago con Culqi.";

        setPaymentMessage(message);
        toast.error(message);
      } finally {
        setIsPaying(false);
      }

      return;
    }

    const errorMessage =
      checkout.error?.user_message ||
      checkout.error?.merchant_message ||
      checkout.error?.message ||
      "No se pudo obtener la respuesta de Culqi.";

    toast.error(errorMessage);
  }

  async function handlePayWithCulqi() {
    if (!activeSession) {
      toast.error("No hay una venta activa para pagar.");

      return;
    }

    if (!env.culqiPublicKey || env.culqiPublicKey === "pk_test_change_this") {
      toast.error("Configura NEXT_PUBLIC_CULQI_PUBLIC_KEY en .env.local.");

      return;
    }

    if (!window.CulqiCheckout) {
      toast.error("El checkout de Culqi todavía no está listo.");

      return;
    }

    setIsPaying(true);
    setPaymentMessage("Preparando el pago con Culqi...");

    let culqiOrderId: string;

    try {
      const orderResponse = await culqiService.createOrder({
        payment_session_id: activeSession.id,
        email: getCulqiEmail(activeSession.receipt_email ?? ""),
      });

      culqiOrderId = orderResponse.culqi_order_id;
      setPaymentMessage("");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo preparar el pago con Culqi.";

      setPaymentMessage(message);
      toast.error(message);
      setIsPaying(false);

      return;
    }

    const paymentMethods = {
      tarjeta: true,
      yape: true,
      billetera: true,
      bancaMovil: true,
      agente: true,
      cuotealo: false,
    };
    const enabledPaymentMethods = Object.entries(paymentMethods)
      .filter(([, isEnabled]) => isEnabled)
      .map(([paymentMethod]) => paymentMethod);

    const config: CulqiCheckoutConfig = {
      settings: {
        title: "Kadosh",
        currency: activeSession.currency,
        amount: amountToCents(activeSession.amount),
        order: culqiOrderId,
        ...(env.culqiRsaId && env.culqiRsaPublicKey
          ? {
              xculqirsaid: env.culqiRsaId,
              rsapublickey: env.culqiRsaPublicKey,
            }
          : {}),
      },
      client: {
        email: getCulqiEmail(activeSession.receipt_email ?? ""),
      },
      options: {
        lang: "es",
        installments: false,
        modal: true,
        paymentMethods,
        paymentMethodsSort: enabledPaymentMethods,
      },
      appearance: {
        theme: "default",
        hiddenCulqiLogo: false,
        hiddenBannerContent: false,
        hiddenBanner: false,
        hiddenToolBarAmount: false,
        hiddenEmail: false,
        menuType: "sidebar",
        buttonCardPayText: "Pagar ahora",
        defaultStyle: {
          bannerColor: "#020617",
          buttonBackground: "#020617",
          buttonTextColor: "#ffffff",
          priceColor: "#020617",
        },
      },
    };

    const checkout = new window.CulqiCheckout(env.culqiPublicKey, config);

    checkout.culqi = () => {
      void handleCulqiResult(checkout);
    };

    checkout.open();
    setIsPaying(false);
  }

  function handleManualRefresh() {
    if (!credentials) {
      router.push("/customer-display/pair");

      return;
    }

    void loadSessions(credentials, true);
  }

  function handlePrintReceipt() {
    const resetAfterPrint = () => {
      setCompletedPayment(null);
      window.removeEventListener("afterprint", resetAfterPrint);

      if (credentials) {
        void loadSessions(credentials);
      }
    };

    window.addEventListener("afterprint", resetAfterPrint);
    window.print();
  }

  function handleUnpairDevice() {
    clearStoredDeviceCredentials();
    router.push("/customer-display/pair");
  }

  const isInitializing = connectionStatus === "initializing";
  const isReconnecting = connectionStatus === "reconnecting";

  return (
    <>
      <Script
        src="https://js.culqi.com/checkout-js"
        strategy="afterInteractive"
        onLoad={() => setIsCulqiReady(true)}
        onError={() => {
          setIsCulqiReady(false);
          toast.error("No se pudo cargar Culqi Checkout.");
        }}
      />

      <main className="min-h-screen bg-white text-slate-950 print:hidden">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ShoppingBag className="h-6 w-6" />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-500">Kadosh</p>
              <h1 className="text-2xl font-bold">Pantalla del cliente</h1>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                {connectionStatus === "online" ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                ) : connectionStatus === "reconnecting" ? (
                  <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}

                {deviceStatus?.device_name || "Validando tablet..."}
              </p>
            </div>
          </div>

          <Card className="w-full border-slate-200 shadow-2xl shadow-slate-200/70">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {activeSession
                  ? "Revise el monto de su compra"
                  : "Esperando una venta"}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-8 text-center">
              {isInitializing ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando tablet...
                </div>
              ) : completedPayment ? (
                <>
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-8 py-10 text-emerald-950">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                    <p className="mt-4 text-2xl font-bold">
                      Compra procesada correctamente
                    </p>
                    <p className="mt-2 text-sm text-emerald-800">
                      {completedPayment.message}
                    </p>
                    <p className="mt-6 text-4xl font-bold tracking-tight">
                      {formatMoney(completedPayment.amount)}
                    </p>
                    <p className="mt-2 text-sm text-emerald-800">
                      Moneda: {completedPayment.currency}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button className="h-12" onClick={handlePrintReceipt}>
                      <Printer className="h-5 w-5" />
                      Imprimir boleta
                    </Button>

                    <Button
                      className="h-12"
                      variant="outline"
                      onClick={() => setCompletedPayment(null)}
                    >
                      Esperar nueva venta
                    </Button>
                  </div>
                </>
              ) : activeSession ? (
                <>
                  <div className="rounded-3xl bg-slate-950 px-8 py-10 text-white">
                    <p className="text-sm text-slate-300">Total a pagar</p>
                    <p className="mt-3 text-5xl font-bold tracking-tight">
                      {formatMoney(activeSession.amount)}
                    </p>
                    <p className="mt-4 text-sm text-slate-300">
                      Moneda: {activeSession.currency}
                    </p>
                  </div>

                  {activeSession.customer_message ? (
                    <p className="text-sm text-slate-600">
                      {activeSession.customer_message}
                    </p>
                  ) : null}

                  <div className="grid gap-3 rounded-2xl border bg-slate-50 p-5 text-left text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Estado</span>
                      <span className="font-semibold">
                        {formatStatus(activeSession.status)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Tablet</span>
                      <span className="font-semibold">
                        {deviceStatus?.device_name || "-"}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="h-12 w-full text-base"
                    disabled={!isCulqiReady || isPaying}
                    onClick={handlePayWithCulqi}
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Procesando pago...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5" />
                        Pagar con Culqi
                      </>
                    )}
                  </Button>

                  {paymentMessage ? (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border bg-slate-50 p-4 text-sm font-medium text-slate-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {paymentMessage}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="rounded-3xl border border-dashed bg-slate-50 px-8 py-12">
                    <p className="text-lg font-semibold">
                      {isReconnecting
                        ? "Reconectando con caja..."
                        : "Esperando venta de caja..."}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {isReconnecting
                        ? "La vinculación se mantiene. Cuando vuelva la conexión, la venta aparecerá automáticamente."
                        : "Cuando caja envíe una venta, aparecerá automáticamente aquí."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      disabled={isRefreshingManually}
                      onClick={handleManualRefresh}
                    >
                      {isRefreshingManually ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      Actualizar
                    </Button>

                    <Button variant="outline" onClick={handleUnpairDevice}>
                      Cambiar vinculación
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {completedPayment ? (
        <ReceiptPrintView
          completedPayment={completedPayment}
          deviceName={deviceStatus?.device_name || "Tablet"}
        />
      ) : null}
    </>
  );
}

function ReceiptPrintView({
  completedPayment,
  deviceName,
}: {
  completedPayment: CompletedPayment;
  deviceName: string;
}) {
  const receipt = completedPayment.receipt;
  const items = receipt?.items ?? [];
  const saleNumber = receipt?.sale_number ?? completedPayment.saleId.slice(0, 8);
  const paidAt = receipt?.paid_at ?? completedPayment.paidAt;

  return (
    <section className="hidden bg-white p-6 text-slate-950 print:block">
      <div className="mx-auto max-w-[760px]">
        <div className="border-b border-slate-300 pb-4 text-center">
          <p className="text-xl font-bold">Kadosh</p>
          <p className="mt-1 text-sm font-semibold">Boleta de venta</p>
          <p className="mt-1 text-xs text-slate-600">
            Comprobante interno de compra
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Venta</p>
            <p className="font-semibold">{saleNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Fecha</p>
            <p className="font-semibold">{formatDateTime(paidAt)}</p>
          </div>
          <div>
            <p className="text-slate-500">Medio de pago</p>
            <p className="font-semibold">Culqi</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Tablet</p>
            <p className="font-semibold">{deviceName}</p>
          </div>
        </div>

        {receipt?.customer ? (
          <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm">
            <p className="font-semibold">
              Cliente: {receipt.customer.first_name}{" "}
              {receipt.customer.last_name || ""}
            </p>
            <p className="mt-1 text-slate-600">
              {receipt.customer.document_type || "Documento"}:{" "}
              {receipt.customer.document_number || "-"}
            </p>
            {receipt.customer.phone || receipt.customer.email ? (
              <p className="mt-1 text-slate-600">
                {[receipt.customer.phone, receipt.customer.email]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            ) : null}
          </div>
        ) : null}

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2">Producto</th>
              <th className="py-2 text-center">Cant.</th>
              <th className="py-2 text-right">P. unit.</th>
              <th className="py-2 text-right">Desc.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-2">
                    <p className="font-medium">{formatItemDescription(item)}</p>
                    <p className="text-xs text-slate-500">SKU: {item.variant_sku}</p>
                  </td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">
                    {formatMoney(item.unit_price)}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(item.discount_amount)}
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {formatMoney(item.subtotal)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-slate-200">
                <td className="py-3" colSpan={4}>
                  Venta pagada con Culqi
                </td>
                <td className="py-3 text-right font-semibold">
                  {formatMoney(completedPayment.amount)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="ml-auto mt-5 w-full max-w-[320px] space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(receipt?.subtotal ?? completedPayment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>{formatMoney(receipt?.discount_total ?? "0")}</span>
          </div>
          <div className="flex justify-between">
            <span>IGV / impuesto</span>
            <span>{formatMoney(receipt?.tax_total ?? "0")}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(receipt?.total ?? completedPayment.amount)}</span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-300 pt-4 text-center text-xs text-slate-600">
          <p>{completedPayment.message}</p>
          <p className="mt-1">Gracias por su compra.</p>
        </div>
      </div>
    </section>
  );
}

