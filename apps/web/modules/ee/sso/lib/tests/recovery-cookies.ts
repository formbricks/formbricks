import { getCookieValueFromHeader } from "@/modules/auth/lib/session-cookie";
import { SSO_RECOVERY_PROOF_COOKIE_NAME } from "@/modules/ee/sso/lib/recovery-proof";

/** The `name=value` pairs a response set, as the `Cookie` header a browser would send back. */
export const cookieHeaderFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

/** The SSO recovery proof cookie a response set (ENG-7310), or null. */
export const proofCookieOf = (response: Response): string | null =>
  getCookieValueFromHeader(cookieHeaderFrom(response), SSO_RECOVERY_PROOF_COOKIE_NAME);
