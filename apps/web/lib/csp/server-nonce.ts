import "server-only";
import { headers } from "next/headers";
import { CSP_NONCE_HEADER } from "./content-security-policy";

/** The nonce `proxy.ts` gave this request; undefined on a request that did not pass through it. */
export const getServerCspNonce = async (): Promise<string | undefined> =>
  (await headers()).get(CSP_NONCE_HEADER) ?? undefined;
