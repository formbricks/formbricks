"use client";

import { createContext, useContext } from "react";
import { resolveDocumentNonce } from "./client-nonce";

const CspNonceContext = createContext<string | undefined>(undefined);

/** Rendered by the root layout with the request's nonce (see `client-nonce.ts`). */
export const CspNonceProvider = ({
  nonce,
  children,
}: {
  readonly nonce: string | undefined;
  readonly children: React.ReactNode;
}) => <CspNonceContext.Provider value={resolveDocumentNonce(nonce)}>{children}</CspNonceContext.Provider>;

/** The nonce for `<style>`/`<script>` elements a component renders; the same on server and client. */
export const useCspNonce = (): string | undefined => useContext(CspNonceContext);
