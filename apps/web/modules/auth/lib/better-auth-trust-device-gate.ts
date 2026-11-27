import { APIError } from "better-auth/api";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

const TRUST_DEVICE_COOKIE = "trust_device";
const VERIFY_PREFIX = "/two-factor/verify-";
const SIGN_IN_PREFIX = "/sign-in/";

const hasCookieNamed = (cookieHeader: string, name: string): boolean =>
  cookieHeader.split(";").some((pair) => pair.trim().split("=")[0] === name);

const withoutCookieNamed = (cookieHeader: string, name: string): string =>
  cookieHeader
    .split(";")
    .filter((pair) => pair.trim().split("=")[0] !== name)
    .join(";")
    .trim();

/**
 * Better Auth `before` hook: Formbricks does not offer "trust this device", so the server must not honour
 * it either (SEC-17, ENG-3990). Better Auth has no option that turns the feature off, only
 * `trustDeviceMaxAge`; the verify endpoints accept `trustDevice: true` from any client, and one completed
 * second factor then yields a 30 day sliding `trust_device` cookie that skips 2FA at `/sign-in/email`.
 *
 * Two parts:
 *  - A `trustDevice` value on any `/two-factor/verify-*` request is refused, so no new cookie is minted.
 *  - A `trust_device` cookie already issued (from before this gate shipped) is dropped from a sign-in
 *    request before the two-factor plugin reads it, so the password alone no longer skips the challenge.
 *    The cookie stays in the browser and its server record stays until it expires; both are inert.
 *
 * Returns the context patch Better Auth merges into the request, or `undefined` when nothing changed.
 */
export const trustDeviceBeforeHandler = (
  ctx: AuthHookContext
): { context: { headers: Headers } } | undefined => {
  if (ctx.path.startsWith(VERIFY_PREFIX)) {
    if ((ctx.body as { trustDevice?: unknown } | undefined)?.trustDevice) {
      throw new APIError("BAD_REQUEST", { message: "trustDevice is not supported" });
    }
    return undefined;
  }

  if (!ctx.path.startsWith(SIGN_IN_PREFIX)) return undefined;

  const source = ctx.headers ?? ctx.request?.headers;
  const cookieHeader = source?.get("cookie");
  if (!source || !cookieHeader) return undefined;

  // The cookie's real name carries Better Auth's configured prefix (`__Secure-` over https).
  const name = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE).name;
  if (!hasCookieNamed(cookieHeader, name)) return undefined;

  const headers = new Headers(source);
  headers.set("cookie", withoutCookieNamed(cookieHeader, name));
  return { context: { headers } };
};
