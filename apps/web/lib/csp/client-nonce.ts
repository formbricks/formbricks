import { setNonce as setStyleSingletonNonce } from "get-nonce";
import { setNonce as setColorfulNonce } from "react-colorful";

declare global {
  interface Window {
    /** goober (react-hot-toast) reads its `<style>` nonce from here. */
    __nonce__?: string;
  }
}

let documentNonce: string | undefined;

/**
 * The nonce of the document's policy, which is the one of the response that loaded the page. A later
 * render of the root layout (`router.refresh()`, a server action) comes from a new request with a new
 * nonce, but the document keeps its policy, so the client stays on the first nonce it saw.
 *
 * The first time, it also hands that nonce to the libraries that create `<style>` elements on their
 * own: goober for toasts, react-style-singleton (via get-nonce) for the scroll lock of Radix dialogs and
 * menus, and react-colorful. On the server it returns the request's nonce unchanged.
 */
export const resolveDocumentNonce = (nonce: string | undefined): string | undefined => {
  if (typeof window === "undefined") return nonce;
  if (documentNonce || !nonce) return documentNonce;
  documentNonce = nonce;
  window.__nonce__ = nonce;
  setStyleSingletonNonce(nonce);
  setColorfulNonce(nonce);
  return documentNonce;
};

/** For code outside React (script loaders): the nonce of the page it runs in. */
export const getClientCspNonce = (): string | undefined => documentNonce;
