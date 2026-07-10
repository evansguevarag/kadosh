export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Kadosh",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010/api/v1",
  scannerWebUrl: process.env.NEXT_PUBLIC_SCANNER_WEB_URL ?? "",
  scannerApiUrl: process.env.NEXT_PUBLIC_SCANNER_API_URL ?? "",
  customerDisplayDeviceId:
    process.env.NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_ID ?? "tablet-caja-01",
  customerDisplayDeviceSecret:
    process.env.NEXT_PUBLIC_CUSTOMER_DISPLAY_DEVICE_SECRET ?? "",
  culqiPublicKey: process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "",
  culqiRsaId: process.env.NEXT_PUBLIC_CULQI_RSA_ID ?? "",
  culqiRsaPublicKey: process.env.NEXT_PUBLIC_CULQI_RSA_PUBLIC_KEY ?? "",
} as const;
