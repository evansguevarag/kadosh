"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Loader2, Printer, ReceiptText, Share2 } from "lucide-react";

import { env } from "@/config/env";
import { ReceiptBusinessHeader } from "@/components/receipts/receipt-business-header";
import type { SaleItem } from "@/types/api";

type PublicReceipt = {
  sale_number: string;
  customer_name: string;
  customer_document_type: string | null;
  customer_document_number: string | null;
  payment_method: string | null;
  operation_code: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  items: SaleItem[];
};

function money(value: string | number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(value));
}

function paymentMethod(value: string | null) {
  const labels: Record<string, string> = {
    CASH: "Efectivo",
    YAPE: "Yape",
    PLIN: "Plin",
    TRANSFER: "Transferencia",
    POS: "Tarjeta POS",
    CULQI: "Culqi",
  };
  return value ? labels[value] || value : "-";
}

export default function PublicReceiptPage() {
  const params = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState("");
  const canShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  useEffect(() => {
    const controller = new AbortController();
    const publicApiUrl = (env.scannerApiUrl || env.apiUrl).replace(/\/$/, "");

    void fetch(
      `${publicApiUrl}/public/receipts/${encodeURIComponent(params.token)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("No encontramos esta boleta.");
        setReceipt((await response.json()) as PublicReceipt);
      })
      .catch((caughtError: Error) => {
        if (caughtError.name !== "AbortError") setError(caughtError.message);
      });

    return () => controller.abort();
  }, [params.token]);

  async function handleShare() {
    if (!navigator.share || !receipt) return;
    await navigator.share({
      title: `Boleta ${receipt.sale_number}`,
      text: `Boleta de compra ${receipt.sale_number} - Kadosh`,
      url: window.location.href,
    });
  }

  const taxableAmount = receipt
    ? Number(receipt.total) - Number(receipt.tax_total)
    : 0;

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-8 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-5 shadow-sm print:max-w-none print:border-0 print:shadow-none">
        {!receipt && !error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando boleta...
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-red-600">{error}</p>
        ) : receipt ? (
          <>
            <div className="mb-5 grid grid-cols-2 gap-2 print:hidden">
              <button className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="button" onClick={() => window.print()}>
                <Download className="h-4 w-4" />
                Descargar / guardar PDF
              </button>
              <button className="flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium" type="button" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
              <button className="flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium disabled:opacity-50" type="button" disabled={!canShare} onClick={() => void handleShare()}>
                <Share2 className="h-4 w-4" />
                Compartir
              </button>
            </div>

            <header>
              <ReceiptText className="mx-auto mb-2 h-7 w-7" />
              <ReceiptBusinessHeader />
            </header>

            <div className="grid grid-cols-2 gap-3 border-b py-4 text-sm">
              <div><p className="text-xs text-slate-500">Venta</p><p className="font-semibold">{receipt.sale_number}</p></div>
              <div className="text-right"><p className="text-xs text-slate-500">Fecha</p><p className="font-semibold">{new Date(receipt.paid_at || receipt.created_at).toLocaleString("es-PE")}</p></div>
              <div><p className="text-xs text-slate-500">Medio de pago</p><p className="font-semibold">{paymentMethod(receipt.payment_method)}</p></div>
              <div className="text-right"><p className="text-xs text-slate-500">Operación</p><p className="font-semibold">{receipt.operation_code || "-"}</p></div>
            </div>

            <div className="my-4 rounded-lg border p-3 text-sm">
              <p className="font-semibold">Cliente: {receipt.customer_name}</p>
              {receipt.customer_document_number ? <p className="mt-1 text-slate-600">{receipt.customer_document_type || "Documento"}: {receipt.customer_document_number}</p> : null}
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b py-2 text-xs font-semibold">
              <span>Producto</span><span>Cant.</span><span>Total</span>
            </div>
            <div className="divide-y">
              {receipt.items.map((item) => (
                <div className="grid grid-cols-[1fr_auto_auto] items-start gap-3 py-3" key={item.id}>
                  <div>
                    <p className="text-sm font-medium">{item.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {money(item.unit_price)} c/u · {item.variant_sku}
                    </p>
                  </div>
                  <p className="text-sm">{item.quantity}</p>
                  <p className="text-sm font-semibold">{money(item.subtotal)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span>Importe antes de descuento</span>
                <span>{money(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Descuento</span>
                <span>{money(receipt.discount_total)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Operación gravada</span>
                <span>{money(taxableAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>IGV incluido (18%)</span>
                <span>{money(receipt.tax_total)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>Total pagado</span>
                <span>{money(receipt.total)}</span>
              </div>
            </div>

            <div className="mt-5 border-t pt-4 text-center text-xs text-slate-500">
              <p>El IGV del 18% ya está incluido en el precio final.</p>
              <p className="mt-1">No se suma ningún importe adicional.</p>
              <p className="mt-3">Gracias por su compra.</p>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
