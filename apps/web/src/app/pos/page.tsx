"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ChevronDown,
  Copy,
  CreditCard,
  Link,
  Loader2,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/use-auth";
import { customerService } from "@/features/customers/customer-service";
import type { CustomerDisplayDevice } from "@/features/payments/customer-display-device-service";
import { paymentService } from "@/features/payments/payment-service";
import {
  PENDING_TABLET_SALE_STORAGE_KEY,
  POS_CART_DRAFT_STORAGE_KEY,
} from "@/features/pos/pos-workspace-storage";
import { productVariantService } from "@/features/products/product-variant-service";
import {
  saleService,
  type SaleCreateRequest,
} from "@/features/sales/sale-service";
import {
  scannerService,
  type ScannerSession,
} from "@/features/scanner/scanner-service";
import { env } from "@/config/env";
import { ApiClientError } from "@/services/api-client";
import { formatPaymentMethod } from "@/lib/status-format";
import type { Customer, ProductVariant, Sale } from "@/types/api";

type CartItem = {
  productVariantId: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  stockQuantity: number;
};

const manualPaymentMethods = ["CASH", "YAPE", "PLIN", "TRANSFER", "POS"] as const;

type ManualReceipt = {
  sale: Sale;
  paymentMethod: string;
  operationCode: string | null;
  paidAt: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function cartItemSubtotal(item: CartItem) {
  return item.unitPrice * item.quantity - item.discountAmount;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatItemDescription(item: Sale["items"][number]) {
  return [item.product_name, item.size, item.color].filter(Boolean).join(" | ");
}

function buildCodeLookupCandidates(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const candidates = [normalizedCode];

  if (/^\d+$/.test(normalizedCode) && normalizedCode.length % 2 === 1) {
    candidates.push(`0${normalizedCode}`);
  }

  return candidates;
}

export default function PosPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [customerDisplayDevices, setCustomerDisplayDevices] = useState<
    CustomerDisplayDevice[]
  >([]);
  const [customerId, setCustomerId] = useState("");
  const [customerDocumentNumber, setCustomerDocumentNumber] = useState("");
  const [customerReceiptEmail, setCustomerReceiptEmail] = useState("");
  const [customerReceiptPhone, setCustomerReceiptPhone] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discountTotal, setDiscountTotal] = useState("0.00");
  const [notes, setNotes] = useState("Venta realizada en tienda.");
  const [manualPaymentMethod, setManualPaymentMethod] =
    useState<(typeof manualPaymentMethods)[number]>("CASH");
  const [manualOperationCode, setManualOperationCode] = useState("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isClearSaleDialogOpen, setIsClearSaleDialogOpen] = useState(false);
  const [lastManualReceipt, setLastManualReceipt] =
    useState<ManualReceipt | null>(null);
  const [pendingTabletSale, setPendingTabletSale] = useState<Sale | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSale, setIsCreatingSale] = useState(false);
  const [isSendingToTablet, setIsSendingToTablet] = useState(false);
  const [isRegisteringManualPayment, setIsRegisteringManualPayment] =
    useState(false);
  const [isFindingCustomer, setIsFindingCustomer] = useState(false);
  const [isUpdatingCustomerContact, setIsUpdatingCustomerContact] =
    useState(false);
  const [scannerSession, setScannerSession] = useState<ScannerSession | null>(
    null,
  );
  const [scannerUrl, setScannerUrl] = useState("");
  const [scannerQrDataUrl, setScannerQrDataUrl] = useState("");
  const [isOperationsPanelOpen, setIsOperationsPanelOpen] = useState(false);
  const [isCreatingScannerSession, setIsCreatingScannerSession] =
    useState(false);
  const [isCancellingTabletSale, setIsCancellingTabletSale] = useState(false);
  const saleFlowInProgressRef = useRef(false);
  const lastScannerScanIdRef = useRef<string | null>(null);
  const scannerPollingErrorShownRef = useRef(false);
  const cartDraftHydratedRef = useRef(false);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  const scannerBufferRef = useRef("");
  const scannerBufferTimeoutRef = useRef<number | null>(null);

  const activeCustomerDisplayDevices = useMemo(
    () => customerDisplayDevices.filter((device) => device.is_active),
    [customerDisplayDevices],
  );

  const selectedDisplayDevice = useMemo(
    () =>
      activeCustomerDisplayDevices.find((device) => device.id === selectedDeviceId) ??
      null,
    [activeCustomerDisplayDevices, selectedDeviceId],
  );

  const buildScannerUrl = useCallback((session: ScannerSession) => {
    const scannerWebUrl = env.scannerWebUrl.trim();
    const scannerApiUrl = env.scannerApiUrl.trim();
    const scannerPageUrl = new URL(
      `/scanner/${encodeURIComponent(session.id)}/${encodeURIComponent(
        session.pairing_token,
      )}`,
      scannerWebUrl || window.location.origin,
    );
    const apiUrl = new URL(scannerApiUrl || env.apiUrl);

    if (
      !scannerApiUrl &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1" &&
      (apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1")
    ) {
      apiUrl.hostname = window.location.hostname;
    }

    if (!scannerApiUrl) {
      scannerPageUrl.searchParams.set("api", apiUrl.toString());
    }

    return scannerPageUrl.toString();
  }, []);

  useEffect(() => {
    if (!cartDraftHydratedRef.current) return;

    if (cartItems.length === 0) {
      window.sessionStorage.removeItem(POS_CART_DRAFT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      POS_CART_DRAFT_STORAGE_KEY,
      JSON.stringify(cartItems),
    );
  }, [cartItems]);

  useEffect(() => {
    const rawDraft = window.sessionStorage.getItem(POS_CART_DRAFT_STORAGE_KEY);

    if (rawDraft) {
      try {
        const storedItems = JSON.parse(rawDraft) as CartItem[];

        if (Array.isArray(storedItems)) {
          queueMicrotask(() => setCartItems(storedItems));
        }
      } catch {
        window.sessionStorage.removeItem(POS_CART_DRAFT_STORAGE_KEY);
      }
    }

    cartDraftHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!token) return;

    const storedSession = scannerService.getStoredSession();

    if (!storedSession) return;

    let isActive = true;
    const storedScannerUrl = buildScannerUrl(storedSession);

    lastScannerScanIdRef.current = scannerService.getLastScanId(
      storedSession.id,
    );
    queueMicrotask(() => {
      if (!isActive) return;

      setScannerSession(storedSession);
      setScannerUrl(storedScannerUrl);
    });

    QRCode.toDataURL(storedScannerUrl, {
      color: {
        dark: "#020617",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      width: 220,
    }).then((dataUrl) => {
      if (isActive) setScannerQrDataUrl(dataUrl);
    });

    return () => {
      isActive = false;
    };
  }, [buildScannerUrl, token]);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);

      const [customersResponse, variantsResponse, devicesResponse] =
        await Promise.all([
        saleService.listCustomers(token),
        saleService.listVariants(token),
        saleService.listCustomerDisplayDevices(token),
      ]);

      const activeDevices = devicesResponse.filter((device) => device.is_active);

      setCustomers(customersResponse);
      setVariants(variantsResponse);
      setCustomerDisplayDevices(devicesResponse);

      if (activeDevices.length > 0) {
        setSelectedDeviceId((currentDeviceId) =>
          currentDeviceId || activeDevices[0].id,
        );
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cargar la información de caja.";

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");

      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, loadData, router]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );

  const activeVariants = useMemo(
    () =>
      variants.filter(
        (variant) => variant.is_active && variant.status === "ACTIVE",
      ),
    [variants],
  );

  const filteredVariants = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return [];
    }

    return activeVariants
      .filter((variant) =>
        [
          variant.sku,
          variant.size,
          variant.color,
          variant.barcode,
          variant.sale_price,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      )
      .slice(0, 8);
  }, [activeVariants, productSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customerId, customers],
  );

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) =>
          total + item.unitPrice * item.quantity - item.discountAmount,
        0,
      ),
    [cartItems],
  );

  const total = useMemo(() => {
    const parsedDiscount = Number(discountTotal || 0);

    return Math.max(subtotal - parsedDiscount, 0);
  }, [discountTotal, subtotal]);

  const hasCartItems = cartItems.length > 0;
  const isSaleFlowBusy =
    isCreatingSale || isSendingToTablet || isRegisteringManualPayment;

  useEffect(() => {
    if (!isLoading && !isSaleFlowBusy) {
      productSearchInputRef.current?.focus();
    }
  }, [isLoading, isSaleFlowBusy]);

  function getCartQuantity(productVariantId: string) {
    return (
      cartItems.find((item) => item.productVariantId === productVariantId)
        ?.quantity ?? 0
    );
  }

  const addVariantToCart = useCallback(
    (variant: ProductVariant, requestedQuantity: number) => {
      if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
        toast.error("La cantidad debe ser mayor a cero.");

        return;
      }

      if (requestedQuantity > variant.stock_quantity) {
        toast.error("La cantidad supera el stock disponible.");

        return;
      }

      const existingItem = cartItems.find(
        (item) => item.productVariantId === variant.id,
      );

      if (existingItem) {
        const nextQuantity = existingItem.quantity + requestedQuantity;

        if (nextQuantity > variant.stock_quantity) {
          toast.error("La cantidad total supera el stock disponible.");

          return;
        }

        setCartItems((currentItems) =>
          currentItems.map((item) =>
            item.productVariantId === variant.id
              ? {
                  ...item,
                  quantity: nextQuantity,
                }
              : item,
          ),
        );

        setProductSearch("");
        setSelectedVariantId("");
        setQuantity("1");
        productSearchInputRef.current?.focus();

        return;
      }

      setCartItems((currentItems) => [
        ...currentItems,
        {
          productVariantId: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          quantity: requestedQuantity,
          unitPrice: Number(variant.sale_price),
          discountAmount: 0,
          stockQuantity: variant.stock_quantity,
        },
      ]);

      setProductSearch("");
      setSelectedVariantId("");
      setQuantity("1");
      productSearchInputRef.current?.focus();
    },
    [cartItems],
  );

  function handleAddItem() {
    if (!selectedVariant) {
      toast.error("Selecciona una presentación.");

      return;
    }

    addVariantToCart(selectedVariant, Number(quantity));
  }

  const handleQuickProductEnter = useCallback(async (searchOverride?: string) => {
    const searchValue = searchOverride ?? productSearch;
    const normalizedSearch = searchValue.trim().toUpperCase();
    const codeCandidates = buildCodeLookupCandidates(normalizedSearch);
    const exactMatch = normalizedSearch
      ? variants.find(
          (variant) =>
            variant.is_active &&
            variant.status === "ACTIVE" &&
            (codeCandidates.includes(variant.barcode?.toUpperCase() || "") ||
              codeCandidates.includes(variant.sku.toUpperCase())),
        )
      : null;
    const variantToAdd = exactMatch ?? selectedVariant ?? filteredVariants[0];

    if (!variantToAdd) {
      if (!normalizedSearch || !token) {
        toast.error("No hay producto para agregar.");

        return;
      }

      try {
        const loadedVariant = await productVariantService.getVariantByCode(
          normalizedSearch,
          token,
        );

        setVariants((currentVariants) => {
          const alreadyLoaded = currentVariants.some(
            (currentVariant) => currentVariant.id === loadedVariant.id,
          );

          return alreadyLoaded
            ? currentVariants
            : [loadedVariant, ...currentVariants];
        });
        setSelectedVariantId(loadedVariant.id);
        addVariantToCart(loadedVariant, Number(quantity));
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "No hay producto para agregar.";

        toast.error(message);
      }

      return;
    }

    setSelectedVariantId(variantToAdd.id);
    addVariantToCart(variantToAdd, Number(quantity));
  }, [
    addVariantToCart,
    filteredVariants,
    productSearch,
    quantity,
    selectedVariant,
    token,
    variants,
  ]);

  useEffect(() => {
    function isEditableElement(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
    }

    function handleGlobalScannerKeyDown(event: KeyboardEvent) {
      if (isSaleFlowBusy || isPaymentDialogOpen || isEditableElement(event.target)) {
        return;
      }

      if (event.key === "Enter") {
        if (!scannerBufferRef.current.trim()) {
          productSearchInputRef.current?.focus();

          return;
        }

        event.preventDefault();
        const scannedCode = scannerBufferRef.current;
        scannerBufferRef.current = "";
        setProductSearch(scannedCode);
        productSearchInputRef.current?.focus();

        void handleQuickProductEnter(scannedCode);

        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      event.preventDefault();

      if (scannerBufferTimeoutRef.current) {
        window.clearTimeout(scannerBufferTimeoutRef.current);
      }

      scannerBufferRef.current += event.key;
      setProductSearch(scannerBufferRef.current);
      productSearchInputRef.current?.focus();

      scannerBufferTimeoutRef.current = window.setTimeout(() => {
        scannerBufferRef.current = "";
      }, 600);
    }

    window.addEventListener("keydown", handleGlobalScannerKeyDown);

    return () => {
      window.removeEventListener("keydown", handleGlobalScannerKeyDown);

      if (scannerBufferTimeoutRef.current) {
        window.clearTimeout(scannerBufferTimeoutRef.current);
      }
    };
  }, [handleQuickProductEnter, isPaymentDialogOpen, isSaleFlowBusy]);

  const findExactVariantByCode = useCallback(
    (code: string) => {
      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        return null;
      }

      return (
        activeVariants.find(
          (variant) => {
            const codeCandidates = buildCodeLookupCandidates(normalizedCode);

            return (
              codeCandidates.includes(variant.barcode?.toUpperCase() || "") ||
              codeCandidates.includes(variant.sku.toUpperCase())
            );
          },
        ) ?? null
      );
    },
    [activeVariants],
  );

  useEffect(() => {
    const normalizedSearch = productSearch.trim();

    if (!normalizedSearch || isSaleFlowBusy || isPaymentDialogOpen) {
      return;
    }

    const exactVariant = findExactVariantByCode(normalizedSearch);

    if (!exactVariant) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      addVariantToCart(exactVariant, Number(quantity));
      toast.success(`Agregado: ${exactVariant.sku}`);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    addVariantToCart,
    findExactVariantByCode,
    isPaymentDialogOpen,
    isSaleFlowBusy,
    productSearch,
    quantity,
  ]);

  const handleScannerCode = useCallback(
    async (code: string) => {
      if (!token) {
        toast.error("Debes iniciar sesión nuevamente.");

        return;
      }

      const normalizedCode = code.trim();
      let variant = findExactVariantByCode(normalizedCode);

      setProductSearch(normalizedCode);

      if (!variant) {
        try {
          variant = await productVariantService.getVariantByCode(
            normalizedCode,
            token,
          );

          setVariants((currentVariants) => {
            const alreadyLoaded = currentVariants.some(
              (currentVariant) => currentVariant.id === variant?.id,
            );

            return alreadyLoaded || !variant
              ? currentVariants
              : [variant, ...currentVariants];
          });
        } catch (error) {
          const message =
            error instanceof ApiClientError
              ? error.message
              : `No se encontró producto para ${normalizedCode}.`;

          setSelectedVariantId("");
          toast.error(message);

          return;
        }
      }

      if (!variant) {
        return;
      }

      setSelectedVariantId(variant.id);
      addVariantToCart(variant, 1);
      toast.success(`Agregado: ${variant.sku}`);
    },
    [addVariantToCart, findExactVariantByCode, token],
  );

  async function handleCreateScannerSession() {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    try {
      setIsCreatingScannerSession(true);

      const createdSession = await scannerService.createSession(token);
      const createdScannerUrl = buildScannerUrl(createdSession);
      const createdScannerQrDataUrl = await QRCode.toDataURL(createdScannerUrl, {
        color: {
          dark: "#020617",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
        margin: 2,
        scale: 8,
        width: 220,
      });

      lastScannerScanIdRef.current = null;
      scannerPollingErrorShownRef.current = false;
      scannerService.saveSession(createdSession);
      scannerService.saveLastScanId(createdSession.id, null);
      setScannerSession(createdSession);
      setScannerUrl(createdScannerUrl);
      setScannerQrDataUrl(createdScannerQrDataUrl);
      setIsOperationsPanelOpen(true);

      toast.success("Escáner móvil listo para vincular.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo iniciar el escáner móvil.";

      toast.error(message);
    } finally {
      setIsCreatingScannerSession(false);
    }
  }

  async function handleCopyScannerUrl() {
    if (!scannerUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(scannerUrl);
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  useEffect(() => {
    if (!scannerSession || !token) {
      return;
    }

    const activeScannerSession = scannerSession;
    const accessToken = token;
    let isPolling = false;

    function pollScannerSession() {
      if (isPolling) {
        return;
      }

      isPolling = true;

      scannerService
        .pollSession(
          activeScannerSession.id,
          accessToken,
          lastScannerScanIdRef.current,
        )
        .then(async (response) => {
          scannerPollingErrorShownRef.current = false;

          for (const scan of response.scans) {
            await handleScannerCode(scan.code);
            lastScannerScanIdRef.current = scan.id;
            scannerService.saveLastScanId(activeScannerSession.id, scan.id);
          }
        })
        .catch((error) => {
          const sessionIsInvalid =
            error instanceof ApiClientError &&
            (error.status === 403 || error.status === 404);

          if (sessionIsInvalid) {
            scannerService.clearStoredSession();
            setScannerSession(null);
            setScannerUrl("");
            setScannerQrDataUrl("");
            toast.error(
              "La vinculación del celular expiró. Vincúlalo nuevamente.",
            );
          } else if (!scannerPollingErrorShownRef.current) {
            scannerPollingErrorShownRef.current = true;
            toast.error(
              "No se pudo consultar el escáner. Se reintentará automáticamente.",
            );
          }
        })
        .finally(() => {
          isPolling = false;
        });
    }

    void pollScannerSession();
    const intervalId = window.setInterval(pollScannerSession, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [handleScannerCode, scannerSession, token]);

  function handleRemoveItem(productVariantId: string) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.productVariantId !== productVariantId),
    );
  }

  function handleChangeCartQuantity(productVariantId: string, nextQuantity: number) {
    const cartItem = cartItems.find(
      (item) => item.productVariantId === productVariantId,
    );

    if (!cartItem) {
      return;
    }

    if (nextQuantity <= 0) {
      handleRemoveItem(productVariantId);

      return;
    }

    if (nextQuantity > cartItem.stockQuantity) {
      toast.error("La cantidad supera el stock disponible.");

      return;
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.productVariantId === productVariantId
          ? {
              ...item,
              quantity: nextQuantity,
            }
          : item,
      ),
    );
  }

  function resetSaleDraft() {
    setCustomerId("");
    setCustomerDocumentNumber("");
    setCustomerReceiptEmail("");
    setCustomerReceiptPhone("");
    setProductSearch("");
    setSelectedVariantId("");
    setQuantity("1");
    setDiscountTotal("0.00");
    setNotes("Venta realizada en tienda.");
    setManualOperationCode("");
    setCartItems([]);
    productSearchInputRef.current?.focus();
  }

  function handleClearCurrentSale() {
    resetSaleDraft();
    setIsClearSaleDialogOpen(false);
    toast.success("Venta actual limpiada.");
  }

  function handleStartNewSale() {
    setLastManualReceipt(null);
    resetSaleDraft();
  }

  function handlePrintManualReceipt() {
    if (!lastManualReceipt) {
      return;
    }

    const resetAfterPrint = () => {
      window.removeEventListener("afterprint", resetAfterPrint);
      handleStartNewSale();
    };

    window.addEventListener("afterprint", resetAfterPrint);
    window.print();
  }

  async function handleFindCustomerByDni() {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    const normalizedDni = customerDocumentNumber.trim();

    if (!/^\d{8}$/.test(normalizedDni)) {
      toast.error("Ingresa un DNI válido de 8 dígitos.");

      return;
    }

    const loadedCustomer = customers.find(
      (customer) =>
        customer.document_type === "DNI" &&
        customer.document_number === normalizedDni,
    );

    if (loadedCustomer) {
      setCustomerId(loadedCustomer.id);
      setCustomerReceiptEmail(loadedCustomer.email ?? "");
      setCustomerReceiptPhone(loadedCustomer.phone ?? "");
      toast.success("Cliente seleccionado.");

      return;
    }

    try {
      setIsFindingCustomer(true);

      const response = await customerService.resolveDni(normalizedDni, token);

      setCustomers((currentCustomers) => [
        response.customer,
        ...currentCustomers.filter(
          (customer) => customer.id !== response.customer.id,
        ),
      ]);
      setCustomerId(response.customer.id);
      setCustomerReceiptEmail(response.customer.email ?? "");
      setCustomerReceiptPhone(response.customer.phone ?? "");

      if (response.source === "APIPERU_CREATED") {
        toast.success("Cliente creado y seleccionado.");
      } else {
        toast.success("Cliente seleccionado.");
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo buscar o registrar el cliente.";

      toast.error(message);
    } finally {
      setIsFindingCustomer(false);
    }
  }

  async function handleUpdateCustomerContact() {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return;
    }

    if (!selectedCustomer) {
      toast.error("Primero selecciona un cliente.");

      return;
    }

    const normalizedEmail = customerReceiptEmail.trim().toLowerCase();
    const normalizedPhone = customerReceiptPhone.replace(/\s/g, "").trim();

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error("Ingresa un correo válido.");

      return;
    }

    try {
      setIsUpdatingCustomerContact(true);

      const updatedCustomer = await customerService.updateCustomer(
        selectedCustomer.id,
        {
          email: normalizedEmail || null,
          phone: normalizedPhone || null,
        },
        token,
      );

      setCustomers((currentCustomers) =>
        currentCustomers.map((customer) =>
          customer.id === updatedCustomer.id ? updatedCustomer : customer,
        ),
      );
      setCustomerReceiptEmail(updatedCustomer.email ?? "");
      setCustomerReceiptPhone(updatedCustomer.phone ?? "");

      toast.success("Datos para comprobante actualizados.");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudieron actualizar los datos del cliente.";

      toast.error(message);
    } finally {
      setIsUpdatingCustomerContact(false);
    }
  }

  async function createSale(): Promise<Sale | null> {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return null;
    }

    if (cartItems.length === 0) {
      toast.error("Agrega al menos una presentación a la venta.");

      return null;
    }

    const payload: SaleCreateRequest = {
      customer_id: customerId || null,
      items: cartItems.map((item) => ({
        product_variant_id: item.productVariantId,
        quantity: item.quantity,
        unit_price: item.unitPrice.toFixed(2),
        discount_amount: item.discountAmount.toFixed(2),
      })),
      discount_total: Number(discountTotal || 0).toFixed(2),
      tax_total: "0.00",
      notes: notes || null,
    };

    try {
      setIsCreatingSale(true);

      const createdSale = await saleService.createSale(payload, token);

      setCartItems([]);
      setDiscountTotal("0.00");
      setQuantity("1");
      setProductSearch("");

      toast.success("Venta creada correctamente.");
      void loadData();

      return createdSale;
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo crear la venta.";

      toast.error(message);

      return null;
    } finally {
      setIsCreatingSale(false);
    }
  }

  async function sendSaleToTablet(sale: Sale) {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return false;
    }

    if (!selectedDeviceId) {
      toast.error("Selecciona una tablet vinculada.");

      return false;
    }

    try {
      setIsSendingToTablet(true);

      await saleService.createPaymentSession(
        {
          sale_id: sale.id,
          device_id: selectedDeviceId,
          customer_message: "Por favor, revise el monto antes de pagar.",
          receipt_email: customerReceiptEmail.trim().toLowerCase() || null,
          expires_in_minutes: 10,
        },
        token,
      );

      setPendingTabletSale(sale);
      window.localStorage.setItem(PENDING_TABLET_SALE_STORAGE_KEY, sale.id);
      resetSaleDraft();
      toast.success("Venta enviada a la tablet seleccionada.");

      return true;
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo enviar la venta a la tablet.";

      toast.error(message);

      return false;
    } finally {
      setIsSendingToTablet(false);
    }
  }

  async function registerManualPaymentForSale(sale: Sale) {
    if (!token) {
      toast.error("Debes iniciar sesión nuevamente.");

      return false;
    }

    if (manualPaymentMethod !== "CASH" && !manualOperationCode.trim()) {
      toast.error("Ingresa el código de operación del pago.");

      return false;
    }

    try {
      setIsRegisteringManualPayment(true);

      await paymentService.createPayment(
        {
          sale_id: sale.id,
          payment_method: manualPaymentMethod,
          amount: Number(sale.total).toFixed(2),
          currency: "PEN",
          operation_code:
            manualPaymentMethod === "CASH"
              ? manualOperationCode.trim() || null
              : manualOperationCode.trim(),
        },
        token,
      );

      setLastManualReceipt({
        sale: {
          ...sale,
          status: "PAID",
          paid_at: new Date().toISOString(),
        },
        paymentMethod: manualPaymentMethod,
        operationCode: manualOperationCode.trim() || null,
        paidAt: new Date().toISOString(),
      });
      resetSaleDraft();
      toast.success("Venta cobrada. Ya puedes imprimir el comprobante.");
      await loadData();

      return true;
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo registrar el pago manual.";

      toast.error(message);

      return false;
    } finally {
      setIsRegisteringManualPayment(false);
    }
  }

  async function handleCreateAndPayManual() {
    if (saleFlowInProgressRef.current) {
      return false;
    }

    saleFlowInProgressRef.current = true;
    const cartSnapshot = cartItems;

    try {
      const createdSale = await createSale();

      if (createdSale) {
        const wasPaid = await registerManualPaymentForSale(createdSale);

        if (!wasPaid && token) {
          try {
            await saleService.cancelSale(createdSale.id, token);
            setCartItems(cartSnapshot);
            toast.info(
              "La venta incompleta fue cancelada y el carrito fue restaurado.",
            );
          } catch {
            toast.error(
              "El pago falló y la venta no pudo cancelarse automáticamente. Revisa el registro de ventas.",
            );
          }
        }

        return wasPaid;
      }

      return false;
    } finally {
      saleFlowInProgressRef.current = false;
    }
  }

  async function handleConfirmPaymentDialog() {
    const wasPaid = await handleCreateAndPayManual();

    if (wasPaid) {
      setIsPaymentDialogOpen(false);
    }
  }

  async function handleCreateAndSendToTablet() {
    if (saleFlowInProgressRef.current) {
      return;
    }

    if (!selectedDeviceId) {
      toast.error("Selecciona una tablet vinculada.");

      return;
    }

    if (pendingTabletSale) {
      toast.error(
        "La pantalla ya tiene una venta esperando pago. Complétala o cancélala antes de enviar otra.",
      );

      return;
    }

    saleFlowInProgressRef.current = true;
    const cartSnapshot = cartItems;

    try {
      const createdSale = await createSale();

      if (createdSale) {
        const wasSent = await sendSaleToTablet(createdSale);

        if (!wasSent && token) {
          try {
            await saleService.cancelSale(createdSale.id, token);
            setCartItems(cartSnapshot);
            toast.info(
              "No se envió la venta. El carrito fue restaurado para reintentar.",
            );
          } catch {
            toast.error(
              "No se envió la venta y no pudo cancelarse automáticamente. Revisa el registro de ventas.",
            );
          }
        }
      }
    } finally {
      saleFlowInProgressRef.current = false;
    }
  }

  async function handleCancelPendingTabletSale() {
    if (!pendingTabletSale || !token) {
      return;
    }

    const shouldCancel = window.confirm(
      `¿Cancelar la venta ${pendingTabletSale.sale_number}? El stock volverá al inventario.`,
    );

    if (!shouldCancel) {
      return;
    }

    try {
      setIsCancellingTabletSale(true);
      await saleService.cancelSale(pendingTabletSale.id, token);
      setPendingTabletSale(null);
      window.localStorage.removeItem(PENDING_TABLET_SALE_STORAGE_KEY);
      toast.success("Venta cancelada y stock devuelto al inventario.");
      await loadData();
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "No se pudo cancelar la venta enviada.";

      toast.error(message);
    } finally {
      setIsCancellingTabletSale(false);
    }
  }

  useEffect(() => {
    if (!pendingTabletSale || !token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void saleService
        .getSale(pendingTabletSale.id, token)
        .then((sale) => {
          if (sale.status === "PAID") {
            setPendingTabletSale(null);
            window.localStorage.removeItem(PENDING_TABLET_SALE_STORAGE_KEY);
            toast.success(`Venta ${sale.sale_number} pagada correctamente.`);
            void loadData();
          } else if (sale.status === "CANCELLED") {
            setPendingTabletSale(null);
            window.localStorage.removeItem(PENDING_TABLET_SALE_STORAGE_KEY);
          }
        })
        .catch(() => undefined);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadData, pendingTabletSale, token]);

  useEffect(() => {
    if (!token || pendingTabletSale) {
      return;
    }

    const pendingSaleId = window.localStorage.getItem(
      PENDING_TABLET_SALE_STORAGE_KEY,
    );

    if (!pendingSaleId) {
      return;
    }

    void saleService
      .getSale(pendingSaleId, token)
      .then((sale) => {
        if (sale.status === "PENDING_PAYMENT") {
          setPendingTabletSale(sale);
        } else {
          window.localStorage.removeItem(PENDING_TABLET_SALE_STORAGE_KEY);
        }
      })
      .catch(() => {
        window.localStorage.removeItem(PENDING_TABLET_SALE_STORAGE_KEY);
      });
  }, [pendingTabletSale, token]);

  return (
    <>
      <div className="print:hidden">
        <AppShell
          title="Caja"
          description="Escanea productos, identifica al cliente, cobra e imprime el comprobante."
        >
      <div className="space-y-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Equipos de venta</p>
                <p className="text-xs text-slate-500">
                  Escáner USB listo · Celular {scannerSession ? "vinculado" : "no vinculado"} ·{" "}
                  {selectedDisplayDevice?.device_name ?? "Sin tablet seleccionada"}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={isOperationsPanelOpen}
                aria-label={
                  isOperationsPanelOpen
                    ? "Ocultar configuración de equipos"
                    : "Mostrar configuración de equipos"
                }
                onClick={() => setIsOperationsPanelOpen((current) => !current)}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isOperationsPanelOpen ? "rotate-180" : ""
                  }`}
                />
                {isOperationsPanelOpen ? "Ocultar" : "Configurar"}
              </Button>
            </div>

            {isOperationsPanelOpen ? (
              <div className="mt-3 border-t pt-3">
                <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={scannerSession ? "outline" : "default"}
                  disabled={isCreatingScannerSession || isSaleFlowBusy}
                  onClick={handleCreateScannerSession}
                >
                  {isCreatingScannerSession ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  {scannerSession ? "Renovar celular" : "Vincular celular"}
                </Button>
              </div>

              {scannerUrl ? (
                <div className="mt-3 grid gap-4 rounded-lg border bg-slate-50 p-3 lg:grid-cols-[120px_1fr]">
                <div
                  aria-label="QR para vincular celular como escáner"
                  className="aspect-square rounded-lg border bg-white bg-contain bg-center bg-no-repeat p-3"
                  role="img"
                  style={{
                    backgroundImage: scannerQrDataUrl
                      ? `url(${scannerQrDataUrl})`
                      : undefined,
                  }}
                >
                  <span className="sr-only">
                    QR para vincular celular como escáner
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Escanea este QR con el celular
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      El celular debe estar en la misma red WiFi que esta
                      computadora. Si la cámara no abre, copia el enlace.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input readOnly className="bg-white text-xs" value={scannerUrl} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyScannerUrl}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                </div>
                </div>
              ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-5 w-5" />
              Escanear y armar venta
            </CardTitle>
            <p className="text-sm text-slate-500">
              Escanea un código, escribe SKU o busca manualmente. Enter agrega
              la primera coincidencia.
            </p>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
                <Label htmlFor="productSearch">Escáner / producto</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="productSearch"
                    ref={productSearchInputRef}
                    className="h-14 bg-white pl-12 text-lg font-semibold"
                    placeholder="Escanea código o escribe SKU"
                    value={productSearch}
                    disabled={isLoading || isSaleFlowBusy}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setSelectedVariantId("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleQuickProductEnter();
                      }
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      disabled={isSaleFlowBusy}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      disabled={isSaleFlowBusy || !selectedVariant}
                      onClick={handleAddItem}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar producto
                    </Button>
                  </div>
                </div>

                {productSearch.trim() ? (
                  <div className="grid gap-2">
                    {filteredVariants.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-3 text-sm text-slate-500">
                        No hay coincidencias. Revisa el código, SKU o registra
                        la presentación si aún no existe.
                      </p>
                    ) : (
                      filteredVariants.map((variant) => (
                        <VariantResultButton
                          key={variant.id}
                          cartQuantity={getCartQuantity(variant.id)}
                          isDisabled={isSaleFlowBusy}
                          isSelected={selectedVariantId === variant.id}
                          variant={variant}
                          onSelect={() => setSelectedVariantId(variant.id)}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-3 text-sm text-slate-500">
                    Listo para escanear. Si usas lector USB o celular
                    vinculado, el producto se agregará aquí.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="customerDocumentNumber">Cliente por DNI</Label>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    id="customerDocumentNumber"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="DNI opcional"
                    value={customerDocumentNumber}
                    disabled={isLoading || isSaleFlowBusy || isFindingCustomer}
                    onChange={(event) => {
                      setCustomerDocumentNumber(
                        event.target.value.replace(/\D/g, "").slice(0, 8),
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleFindCustomerByDni();
                      }
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoading || isSaleFlowBusy || isFindingCustomer}
                    onClick={handleFindCustomerByDni}
                  >
                    {isFindingCustomer ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar
                  </Button>
                </div>

                {selectedCustomer ? (
                  <div className="space-y-3 rounded-xl border bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {selectedCustomer.first_name}{" "}
                          {selectedCustomer.last_name}
                        </p>
                        <p className="text-slate-500">
                          DNI {selectedCustomer.document_number}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomerId("");
                          setCustomerReceiptEmail("");
                          setCustomerReceiptPhone("");
                        }}
                      >
                        Quitar
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs text-slate-600"
                          htmlFor="customerReceiptEmail"
                        >
                          Correo para comprobante
                        </Label>
                        <Input
                          id="customerReceiptEmail"
                          type="email"
                          placeholder="cliente@correo.com"
                          value={customerReceiptEmail}
                          disabled={isSaleFlowBusy || isUpdatingCustomerContact}
                          onChange={(event) =>
                            setCustomerReceiptEmail(event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          className="text-xs text-slate-600"
                          htmlFor="customerReceiptPhone"
                        >
                          Teléfono opcional
                        </Label>
                        <Input
                          id="customerReceiptPhone"
                          inputMode="tel"
                          placeholder="924454127"
                          value={customerReceiptPhone}
                          disabled={isSaleFlowBusy || isUpdatingCustomerContact}
                          onChange={(event) =>
                            setCustomerReceiptPhone(event.target.value)
                          }
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSaleFlowBusy || isUpdatingCustomerContact}
                      onClick={handleUpdateCustomerContact}
                    >
                      {isUpdatingCustomerContact ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Guardar datos de comprobante
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Opcional. Si no hay DNI, la venta queda como público
                    general.
                  </p>
                )}
              </div>

              {selectedVariant ? (
                <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{selectedVariant.sku}</p>
                      <p className="text-slate-500">
                        {selectedVariant.size || "-"} |{" "}
                        {selectedVariant.color || "-"} | Stock{" "}
                        {selectedVariant.stock_quantity}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatMoney(Number(selectedVariant.sale_price))}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="discountTotal">Descuento total</Label>
                <Input
                  id="discountTotal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountTotal}
                  disabled={isSaleFlowBusy}
                  onChange={(event) => setDiscountTotal(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Input
                  id="notes"
                  value={notes}
                  disabled={isSaleFlowBusy}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerDisplayDevice">
                  Tablet de pantalla cliente
                </Label>
                <select
                  id="customerDisplayDevice"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedDeviceId}
                  disabled={
                    isLoading ||
                    isSaleFlowBusy ||
                    activeCustomerDisplayDevices.length === 0
                  }
                  onChange={(event) => setSelectedDeviceId(event.target.value)}
                >
                  <option value="">Selecciona una tablet</option>
                  {activeCustomerDisplayDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.device_name}
                    </option>
                  ))}
                </select>

                {activeCustomerDisplayDevices.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No hay tablets activas. Vincula una desde “Pantallas
                    cliente”.
                  </p>
                ) : null}
              </div>

            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          {pendingTabletSale ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="gap-3">
                <div>
                  <CardTitle className="text-amber-950">
                    Pago enviado a la pantalla
                  </CardTitle>
                  <p className="mt-1 text-sm text-amber-800">
                    {pendingTabletSale.sale_number} ·{" "}
                    {formatMoney(Number(pendingTabletSale.total))}
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    Esperando que el cliente complete el pago con Culqi.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCancellingTabletSale}
                  onClick={() => void handleCancelPendingTabletSale()}
                >
                  {isCancellingTabletSale ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Cancelar venta
                </Button>
              </CardHeader>
            </Card>
          ) : null}

          {lastManualReceipt ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-emerald-950">
                    <ReceiptText className="h-5 w-5" />
                    Compra cobrada
                  </CardTitle>
                  <p className="mt-1 text-sm text-emerald-800">
                    {lastManualReceipt.sale.sale_number} ·{" "}
                    {formatMoney(Number(lastManualReceipt.sale.total))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleStartNewSale}
                  >
                    Nueva venta
                  </Button>
                  <Button type="button" onClick={handlePrintManualReceipt}>
                    <Printer className="h-4 w-4" />
                    Imprimir comprobante
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito actual
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {cartItems.length} producto{cartItems.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-950 px-4 py-3 text-right text-white">
                <p className="text-xs text-slate-300">Total</p>
                <p className="text-2xl font-bold">{formatMoney(total)}</p>
              </div>
            </CardHeader>

            <CardContent>
              {cartItems.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Todavía no hay productos en la venta.
                </p>
              ) : (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div
                      className="rounded-lg border bg-white p-3"
                      key={item.productVariantId}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{item.sku}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.size || "-"} · {item.color || "-"} · Stock{" "}
                            {item.stockQuantity}
                          </p>
                        </div>
                        <Button
                          aria-label={`Quitar ${item.sku}`}
                          size="icon-sm"
                          variant="ghost"
                          type="button"
                          onClick={() =>
                            handleRemoveItem(item.productVariantId)
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-3 grid grid-cols-[auto_1fr] items-end gap-3 border-t pt-3">
                        <div>
                          <p className="mb-1 text-xs font-medium text-slate-500">
                            Cantidad
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              aria-label={`Restar una unidad de ${item.sku}`}
                              size="icon-sm"
                              variant="outline"
                              type="button"
                              onClick={() =>
                                handleChangeCartQuantity(
                                  item.productVariantId,
                                  item.quantity - 1,
                                )
                              }
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              aria-label={`Cantidad de ${item.sku}`}
                              className="h-8 w-14 text-center"
                              min="1"
                              type="number"
                              value={item.quantity}
                              onChange={(event) =>
                                handleChangeCartQuantity(
                                  item.productVariantId,
                                  Number(event.target.value),
                                )
                              }
                            />
                            <Button
                              aria-label={`Agregar una unidad de ${item.sku}`}
                              size="icon-sm"
                              variant="outline"
                              type="button"
                              disabled={item.quantity >= item.stockQuantity}
                              onClick={() =>
                                handleChangeCartQuantity(
                                  item.productVariantId,
                                  item.quantity + 1,
                                )
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-right">
                          <div>
                            <p className="text-xs text-slate-500">Precio</p>
                            <p className="mt-1 text-sm font-medium">
                              {formatMoney(item.unitPrice)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Subtotal</p>
                            <p className="mt-1 font-semibold">
                              {formatMoney(cartItemSubtotal(item))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cartItems.length > 0 ? (
                <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal carrito</span>
                    <span className="font-semibold">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-slate-500">Descuento total</span>
                    <span className="font-semibold">
                      {formatMoney(Number(discountTotal || 0))}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-3 text-xl font-bold">
                    <span>Total</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                <Button
                  className="h-11 w-full"
                  type="button"
                  disabled={isSaleFlowBusy || !hasCartItems}
                  onClick={() => setIsPaymentDialogOpen(true)}
                >
                  {isRegisteringManualPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cobrando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Cobrar venta
                    </>
                  )}
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  disabled={
                    isSaleFlowBusy ||
                    !selectedDeviceId ||
                    !hasCartItems ||
                    Boolean(pendingTabletSale)
                  }
                  onClick={handleCreateAndSendToTablet}
                >
                  {isSendingToTablet ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar a tablet
                    </>
                  )}
                </Button>

                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  disabled={
                    isSaleFlowBusy ||
                    (!hasCartItems &&
                      !customerId &&
                      !customerDocumentNumber &&
                      !productSearch)
                  }
                  onClick={() => setIsClearSaleDialogOpen(true)}
                >
                  Limpiar venta actual
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
        </AppShell>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cobrar venta</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-sm text-slate-300">Total a cobrar</p>
              <p className="mt-2 text-4xl font-bold">{formatMoney(total)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualPaymentMethod">Método de pago</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {manualPaymentMethods.map((paymentMethod) => (
                  <Button
                    key={paymentMethod}
                    type="button"
                    variant={
                      manualPaymentMethod === paymentMethod
                        ? "default"
                        : "outline"
                    }
                    disabled={isSaleFlowBusy}
                    onClick={() => setManualPaymentMethod(paymentMethod)}
                  >
                    {formatPaymentMethod(paymentMethod)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualOperationCode">Código operación</Label>
              <Input
                id="manualOperationCode"
                placeholder={
                  manualPaymentMethod === "CASH" ? "Opcional" : "Obligatorio"
                }
                value={manualOperationCode}
                disabled={isSaleFlowBusy}
                onChange={(event) =>
                  setManualOperationCode(event.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaleFlowBusy}
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaleFlowBusy || !hasCartItems}
              onClick={handleConfirmPaymentDialog}
            >
              {isRegisteringManualPayment || isCreatingSale ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cobrando...
                </>
              ) : (
                "Confirmar cobro"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClearSaleDialogOpen}
        onOpenChange={setIsClearSaleDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limpiar venta actual</DialogTitle>
            <p className="text-sm text-slate-500">
              Se quitarán los productos, el cliente, el descuento y las notas
              ingresadas. Esta acción no afecta ventas ya enviadas o cobradas.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsClearSaleDialogOpen(false)}
            >
              Conservar venta
            </Button>
            <Button type="button" onClick={handleClearCurrentSale}>
              Limpiar venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastManualReceipt ? (
        <ManualReceiptPrintView receipt={lastManualReceipt} />
      ) : null}
    </>
  );
}

function VariantResultButton({
  cartQuantity,
  isDisabled,
  isSelected,
  variant,
  onSelect,
}: {
  cartQuantity: number;
  isDisabled: boolean;
  isSelected: boolean;
  variant: ProductVariant;
  onSelect: () => void;
}) {
  const remainingStock = variant.stock_quantity - cartQuantity;

  return (
    <button
      className={`rounded-xl border p-3 text-left text-sm transition hover:bg-slate-50 ${
        isSelected ? "border-slate-950 bg-slate-50" : "border-slate-200"
      }`}
      disabled={isDisabled || remainingStock <= 0}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{variant.sku}</p>
          <p className="text-xs text-slate-500">
            {variant.size || "-"} | {variant.color || "-"} | Stock{" "}
            {variant.stock_quantity}
          </p>
          {cartQuantity > 0 ? (
            <p className="mt-1 text-xs font-medium text-slate-700">
              En carrito: {cartQuantity} | Disponible: {remainingStock}
            </p>
          ) : null}
        </div>
        <p className="font-semibold">{formatMoney(Number(variant.sale_price))}</p>
      </div>
    </button>
  );
}

function ManualReceiptPrintView({ receipt }: { receipt: ManualReceipt }) {
  const sale = receipt.sale;

  return (
    <section className="hidden bg-white p-6 text-slate-950 print:block">
      <div className="mx-auto max-w-[760px]">
        <div className="border-b border-slate-300 pb-4 text-center">
          <p className="text-xl font-bold">Kadosh</p>
          <p className="mt-1 text-sm font-semibold">Comprobante de venta</p>
          <p className="mt-1 text-xs text-slate-600">
            Comprobante interno de compra
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Venta</p>
            <p className="font-semibold">{sale.sale_number}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Fecha</p>
            <p className="font-semibold">{formatDateTime(receipt.paidAt)}</p>
          </div>
          <div>
            <p className="text-slate-500">Medio de pago</p>
            <p className="font-semibold">
              {formatPaymentMethod(receipt.paymentMethod)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Operación</p>
            <p className="font-semibold">{receipt.operationCode || "-"}</p>
          </div>
        </div>

        {sale.customer ? (
          <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm">
            <p className="font-semibold">
              Cliente: {sale.customer.first_name} {sale.customer.last_name || ""}
            </p>
            <p className="mt-1 text-slate-600">
              {sale.customer.document_type || "Documento"}:{" "}
              {sale.customer.document_number || "-"}
            </p>
            {sale.customer.phone || sale.customer.email ? (
              <p className="mt-1 text-slate-600">
                {[sale.customer.phone, sale.customer.email]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm">
            <p className="font-semibold">Cliente: Público general</p>
          </div>
        )}

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
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="py-2">
                  <p className="font-medium">{formatItemDescription(item)}</p>
                  <p className="text-xs text-slate-500">SKU: {item.variant_sku}</p>
                </td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">
                  {formatMoney(Number(item.unit_price))}
                </td>
                <td className="py-2 text-right">
                  {formatMoney(Number(item.discount_amount))}
                </td>
                <td className="py-2 text-right font-semibold">
                  {formatMoney(Number(item.subtotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 w-full max-w-[320px] space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(Number(sale.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>{formatMoney(Number(sale.discount_total))}</span>
          </div>
          <div className="flex justify-between">
            <span>IGV / impuesto</span>
            <span>{formatMoney(Number(sale.tax_total))}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(Number(sale.total))}</span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-300 pt-4 text-center text-xs text-slate-600">
          <p>Venta procesada correctamente.</p>
          <p className="mt-1">Gracias por su compra.</p>
        </div>
      </div>
    </section>
  );
}
