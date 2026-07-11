export const POS_CART_DRAFT_STORAGE_KEY = "kadosh_pos_cart_draft";
export const PENDING_TABLET_SALE_STORAGE_KEY =
  "kadosh_pending_tablet_sale_id";

export function clearPosWorkspaceStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(POS_CART_DRAFT_STORAGE_KEY);
  window.localStorage.removeItem(PENDING_TABLET_SALE_STORAGE_KEY);
}
