const businessInfo = {
  legalName: "KADOSH S.A.C.", // Completa aquí la razón social.
  address: "Asoc las Magnolias de Copacabana Etapa 2, Puente Piedra", // Completa aquí la dirección fiscal o comercial.
  phone: "924454127", // Completa aquí el teléfono de contacto.
};

export function ReceiptBusinessHeader() {
  return (
    <div className="border-b border-slate-300 pb-4 text-center">
      <p className="text-xl font-bold uppercase">Kadosh</p>
      <p className="mt-1 text-sm font-semibold">RUC 10709009945</p>
      {businessInfo.legalName ? (
        <p className="mt-1 text-xs font-medium uppercase">
          {businessInfo.legalName}
        </p>
      ) : null}
      {businessInfo.address ? (
        <p className="mt-1 text-xs text-slate-600">{businessInfo.address}</p>
      ) : null}
      {businessInfo.phone ? (
        <p className="mt-1 text-xs text-slate-600">
          Teléfono: {businessInfo.phone}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold">Comprobante de venta</p>
      <p className="mt-1 text-xs text-slate-600">
        Comprobante interno de compra
      </p>
    </div>
  );
}
