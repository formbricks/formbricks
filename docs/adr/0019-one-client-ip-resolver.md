# One client-IP resolver feeds both rate limiters

The app has two rate limiters: our own (`applyIPRateLimit`) and Better Auth's, which holds the tightest sign-in, sign-up, reset and 2FA limits. Both read the client address from one place (ENG-2097). `apps/web/proxy.ts` computes it with `resolveClientIp` (`apps/web/lib/utils/client-ip.ts`) and sets it, never appends it, on the single-value `x-formbricks-client-ip` header, and Better Auth's `ipAddressHeaders` reads only that header. `TRUSTED_PROXY_HOP_COUNT` is the one operator setting; the resolver validates the address, strips a port and masks IPv6 to its /64.

## Considered Options

- **Set Better Auth's `trustedProxies` to the operator's proxy CIDR ranges**: correct, but it needs operator knowledge and upkeep as CDN ranges change, so most self-hosted instances would stay broken. Without it, Better Auth resolved no address and put every request in one shared bucket: five requests locked every user out of sign-in.

## Consequences

- A new limiter, or a new reader of the client address (audit `meta.ipAddress`, response metadata), reads the resolved header rather than `X-Forwarded-For`.
- A hop count higher than the real proxy chain lets callers spoof their address by prepending entries; the Helm chart pins it next to the ingress it describes.
