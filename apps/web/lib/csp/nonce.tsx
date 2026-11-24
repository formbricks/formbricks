"use client";

import { setNonce as setStyleSingletonNonce } from "get-nonce";
import { createContext, useContext } from "react";
import { setNonce as setColorfulNonce } from "react-colorful";

declare global {
  interface Window {
    /** goober (react-hot-toast) reads its `<style>` nonce from here. */
    __nonce__?: string;
  }
}

let clientNonce: string | undefined;

/**
 * The nonce of the document's policy, which is the one of the response that loaded the page. A later
 * render of the root layout (`router.refresh()`, a server action) comes from a new request with a new
 * nonce, but the document keeps its policy, so the client stays on the first nonce it saw.
 *
 * It also hands that nonce to the libraries that create `<style>` elements on their own: goober for
 * toasts, react-style-singleton (via get-nonce) for the scroll lock of Radix dialogs and menus, and
 * react-colorful. Runs during render, before any of them can inject a style.
 */
const resolveNonce = (nonce: string | undefined): string | undefined => {
  if (typeof window === "undefined") return nonce;
  if (clientNonce || !nonce) return clientNonce;
  clientNonce = nonce;
  window.__nonce__ = nonce;
  setStyleSingletonNonce(nonce);
  setColorfulNonce(nonce);
  return clientNonce;
};

/** For code outside React (script loaders): the nonce of the page it runs in. */
export const getClientCspNonce = (): string | undefined => clientNonce;

const CspNonceContext = createContext<string | undefined>(undefined);

export const CspNonceProvider = ({
  nonce,
  children,
}: {
  readonly nonce: string | undefined;
  readonly children: React.ReactNode;
}) => {
  return <CspNonceContext.Provider value={resolveNonce(nonce)}>{children}</CspNonceContext.Provider>;
};

/** The nonce for `<style>`/`<script>` elements a component renders; the same on server and client. */
export const useCspNonce = (): string | undefined => useContext(CspNonceContext);
