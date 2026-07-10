"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/config/env";

const SCAN_COOLDOWN_MS = 2500;
const EMPTY_SCANNER_CONFIG: ScannerConfig = {
  apiBaseUrl: "",
  pairingToken: "",
  sessionId: "",
};

type ScannerConfig = {
  apiBaseUrl: string;
  pairingToken: string;
  sessionId: string;
};

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getScannerConfig(
  routeSessionId?: string,
  routePairingToken?: string,
  searchApiUrl?: string | null,
  searchSessionId?: string | null,
  searchPairingToken?: string | null,
): ScannerConfig {
  if (typeof window === "undefined") {
    return EMPTY_SCANNER_CONFIG;
  }

  return {
    apiBaseUrl: (searchApiUrl || env.scannerApiUrl || env.apiUrl).replace(
      /\/$/,
      "",
    ),
    pairingToken: routePairingToken || searchPairingToken || "",
    sessionId: routeSessionId || searchSessionId || "",
  };
}

export default function ScannerPage() {
  const routeParams = useParams<{
    sessionId?: string | string[];
    pairingToken?: string | string[];
  }>();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCodeRef = useRef("");
  const lastSentAtRef = useRef(0);
  const blockedUntilRef = useRef(0);
  const cooldownTimeoutRef = useRef<number | null>(null);

  const [scannerConfig, setScannerConfig] = useState<ScannerConfig>(
    EMPTY_SCANNER_CONFIG,
  );
  const [manualCode, setManualCode] = useState("");
  const [cameraStatus, setCameraStatus] = useState("Preparando escáner...");
  const [lastSentCode, setLastSentCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const routeSessionId = firstParam(routeParams.sessionId);
  const routePairingToken = firstParam(routeParams.pairingToken);
  const nextScannerConfig = useMemo(
    () =>
      getScannerConfig(
        routeSessionId,
        routePairingToken,
        searchParams.get("api"),
        searchParams.get("s") || searchParams.get("session"),
        searchParams.get("t") || searchParams.get("token"),
      ),
    [routePairingToken, routeSessionId, searchParams],
  );

  const apiBaseUrl = scannerConfig.apiBaseUrl;
  const pairingToken = scannerConfig.pairingToken;
  const sessionId = scannerConfig.sessionId;
  const cameraStatusMessage =
    !apiBaseUrl
      ? "Leyendo datos de vinculación..."
      : !sessionId || !pairingToken
      ? "El enlace no tiene datos de vinculación."
      : typeof window !== "undefined" && !window.isSecureContext
        ? "La cámara del celular requiere HTTPS o un origen seguro."
      : typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia
        ? "Este navegador no permite usar la cámara aquí."
        : typeof window !== "undefined" && !window.BarcodeDetector
          ? "Este navegador no soporta lectura automática. Usa el campo manual."
          : cameraStatus;

  const sendCode = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim();

      if (!normalizedCode) {
        toast.error("Ingresa o escanea un código.");

        return;
      }

      if (!sessionId || !pairingToken || !apiBaseUrl) {
        toast.error("El enlace de escáner no es válido.");

        return;
      }

      const now = Date.now();

      if (now < blockedUntilRef.current) {
        return;
      }

      if (
        lastCodeRef.current === normalizedCode &&
        now - lastSentAtRef.current < SCAN_COOLDOWN_MS
      ) {
        return;
      }

      try {
        setIsSending(true);

        const response = await fetch(
          `${apiBaseUrl}/scanner-sessions/${sessionId}/scans`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pairing_token: pairingToken,
              code: normalizedCode,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("No se pudo enviar el código a Caja.");
        }

        lastCodeRef.current = normalizedCode;
        lastSentAtRef.current = now;
        blockedUntilRef.current = Date.now() + SCAN_COOLDOWN_MS;
        setLastSentCode(normalizedCode);
        setManualCode("");
        setIsCoolingDown(true);
        setCameraStatus("Código enviado. Retira la prenda y apunta al siguiente.");

        if (navigator.vibrate) {
          navigator.vibrate(90);
        }

        if (cooldownTimeoutRef.current) {
          window.clearTimeout(cooldownTimeoutRef.current);
        }

        cooldownTimeoutRef.current = window.setTimeout(() => {
          setIsCoolingDown(false);
          setCameraStatus("Listo para escanear el siguiente código.");
        }, SCAN_COOLDOWN_MS);

        toast.success("Código enviado a Caja.");
      } catch {
        toast.error("No se pudo enviar el código a Caja.");
      } finally {
        setIsSending(false);
      }
    },
    [apiBaseUrl, pairingToken, sessionId],
  );

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendCode(manualCode);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setScannerConfig(nextScannerConfig);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [nextScannerConfig]);

  useEffect(() => {
    if (!sessionId || !pairingToken) {
      return;
    }

    if (!window.isSecureContext) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    if (!window.BarcodeDetector) {
      return;
    }

    let isActive = true;
    let frameId = 0;
    let detector: BarcodeDetectorInstance;

    async function startCamera() {
      try {
        detector = new window.BarcodeDetector!({
          formats: ["code_128", "ean_13", "ean_8", "qr_code"],
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
          audio: false,
        });

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());

          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraStatus("Cámara activa. Apunta al código de barras.");

        const detectFrame = async () => {
          if (!isActive || !videoRef.current) {
            return;
          }

          try {
            const results = await detector.detect(videoRef.current);
            const code = results[0]?.rawValue;

            if (code) {
              await sendCode(code);
            }
          } catch {
            setCameraStatus("No se pudo leer la imagen de la cámara.");
          }

          frameId = window.setTimeout(detectFrame, 350);
        };

        void detectFrame();
      } catch {
        setCameraStatus(
          "No se pudo abrir la cámara. Usa el campo manual o revisa permisos.",
        );
      }
    }

    void startCamera();

    return () => {
      isActive = false;
      window.clearTimeout(frameId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [apiBaseUrl, pairingToken, sendCode, sessionId]);

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        window.clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-5">
        <header>
          <p className="text-sm text-slate-400">Kadosh</p>
          <h1 className="text-2xl font-bold">Escáner móvil</h1>
        </header>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            className="aspect-[3/4] w-full object-cover"
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.95)]" />
          {isCoolingDown ? (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-emerald-950">
              Enviado. Preparando siguiente lectura...
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-950">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Estado</p>
              <p className="text-sm text-slate-300">{cameraStatusMessage}</p>
              {!sessionId || !pairingToken ? (
                <p className="mt-2 text-xs text-amber-100">
                  Vuelve a Caja, presiona Vincular celular y escanea el QR nuevo.
                </p>
              ) : null}
            </div>
          </div>

          {lastSentCode ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Último enviado: {lastSentCode}
            </div>
          ) : null}
        </section>

        <form className="space-y-3" onSubmit={handleManualSubmit}>
          <div className="space-y-2">
            <Label htmlFor="manualCode" className="text-white">
              Código manual
            </Label>
            <Input
              id="manualCode"
              className="border-white/10 bg-white text-slate-950"
              placeholder="SKU o código de barras"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
            />
          </div>

          <Button
            className="w-full bg-white text-slate-950 hover:bg-slate-200"
            type="submit"
            disabled={isSending || isCoolingDown}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar a Caja
          </Button>
        </form>
      </div>
    </main>
  );
}
