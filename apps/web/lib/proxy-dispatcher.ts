import { ProxyAgent } from "undici";
import { env } from "@/lib/env";

/**
 * Shared undici dispatcher for every outbound call to the Formbricks license server.
 *
 * Node's built-in `fetch` ignores `HTTP_PROXY` / `HTTPS_PROXY`, so a self-hosted instance whose only
 * egress is a corporate proxy has to pass this explicitly. It is a module-level singleton on purpose:
 * `ProxyAgent` owns connection pools, and creating one per request leaks sockets in a long-lived
 * process. Both the license check and the usage update go through it — a caller that skips it
 * reaches the server directly, which on a proxied network means it never reaches it at all.
 */
const proxyUrl = env.HTTPS_PROXY ?? env.HTTP_PROXY;

export const proxyDispatcher: ProxyAgent | undefined = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

/** `fetch` options extended with undici's dispatcher, which the DOM `RequestInit` type does not carry. */
export type TProxiedRequestInit = RequestInit & { dispatcher?: ProxyAgent };
