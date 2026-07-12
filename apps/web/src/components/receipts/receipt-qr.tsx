"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import { env } from "@/config/env";

export function ReceiptQr({
  receiptToken,
  onReady,
}: {
  receiptToken: string;
  onReady?: () => void;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!receiptToken) {
      onReadyRef.current?.();
      return;
    }

    let active = true;
    const publicWebUrl = (env.scannerWebUrl || window.location.origin).replace(/\/$/, "");
    const url = `${publicWebUrl}/receipt/${encodeURIComponent(receiptToken)}`;
    void QRCode.toDataURL(url, { width: 180, margin: 1, errorCorrectionLevel: "M" })
      .then((value) => {
        if (!active) return;
        setDataUrl(value);
        onReadyRef.current?.();
      });
    return () => { active = false; };
  }, [receiptToken]);

  if (!receiptToken) {
    return (
      <p className="mt-4 border-t pt-4 text-center text-xs text-red-600">
        QR no disponible. Reinicia el backend y vuelve a cargar la venta.
      </p>
    );
  }

  if (!dataUrl) return null;

  return (
    <div className="mt-4 flex flex-col items-center border-t pt-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="QR único de la boleta" className="h-32 w-32" src={dataUrl} />
      <p className="mt-2 text-xs font-semibold">Escanea para consultar esta boleta</p>
      <p className="mt-1 text-[10px] text-slate-500">También permite identificar la compra para cambios.</p>
    </div>
  );
}
