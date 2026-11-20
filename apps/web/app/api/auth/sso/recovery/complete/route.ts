import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { AUTH_TRUSTED_ORIGINS, WEBAPP_URL } from "@/lib/constants";
import { loggableError } from "@/lib/utils/loggable-error";
import { withAuthRequestBodyLimit } from "@/modules/auth/lib/auth-request-body-limit";
import { getSession } from "@/modules/auth/lib/session";
import {
  BETTER_AUTH_SESSION_COOKIE_NAMES,
  getCookieValueFromHeader,
  getSessionTokenFromCookieHeader,
} from "@/modules/auth/lib/session-cookie";
import { revokeSessionByToken } from "@/modules/auth/lib/session-revocation";
import {
  SSO_RECOVERY_PROOF_COOKIE_NAME,
  SSO_RECOVERY_PROOF_COOKIE_OPTIONS,
} from "@/modules/ee/sso/lib/recovery-proof";
import {
  SsoRecoveryError,
  cancelSsoRecovery,
  completeSsoRecovery,
  getSsoRecoveryConfirmUrl,
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoveryRefusal,
} from "@/modules/ee/sso/lib/sso-recovery";

const clearSessionCookies = (response: NextResponse) => {
  for (const cookieName of BETTER_AUTH_SESSION_COOKIE_NAMES) {
    response.cookies.set({
      name: cookieName,
      value: "",
      expires: new Date(0),
      path: "/",
      secure: cookieName.startsWith("__Secure-"),
    });
  }
};

const buildFailedRecoveryResponse = async (request: Request, redirectUrl: string) => {
  const response = NextResponse.redirect(redirectUrl, 303);
  clearSessionCookies(response);

  const sessionToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));
  if (!sessionToken) {
    return response;
  }

  try {
    // Through the two-store revocation, not a raw Prisma delete: sessions live in Redis too, and a
    // DB-only delete would leave this one resolvable by `getSession` until its TTL (ENG-2557).
    await revokeSessionByToken(sessionToken);
  } catch (error) {
    logger.error(
      { ...loggableError(error) },
      "Failed to delete SSO recovery session after recovery completion error"
    );
  }

  return response;
};

/**
 * GET never links (ENG-7395). It is what the emailed link redirects to, and a GET can be issued by a
 * mail scanner, a link preview or a page the account holder never meant to act on. It only forwards to
 * the confirmation page, which names the provider and POSTs back here when the account holder chooses
 * to link. The completion URL keeps its shape, so links already sent and the 2FA path (the login page
 * follows this URL as its callback) both land on the page.
 */
const getHandler = (request: Request) => {
  // An opaque id standing for a server-side record, not a payload (ENG-2783). The intent used to ride
  // here as a JWT, which is what let each retry nest the previous attempt's whole URL inside the next.
  const stateId = new URL(request.url).searchParams.get("state");

  if (!stateId) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl());
  }

  return NextResponse.redirect(getSsoRecoveryConfirmUrl(stateId));
};

/**
 * The origins a confirmation can come from: this app's, and the ones Better Auth already trusts
 * (`BETTER_AUTH_URL`, `NEXTAUTH_URL`). They differ on a deployment whose public URL is not `WEBAPP_URL`,
 * such as one behind a TLS proxy, and refusing those would refuse every user there.
 */
const ACCEPTED_ORIGINS = new Set([WEBAPP_URL, ...AUTH_TRUSTED_ORIGINS].map((url) => new URL(url).origin));

/**
 * Only a same-origin form submission made by navigating the page acts (ENG-7395).
 *
 * `Origin` must be one of this app's. Browsers send it on a form POST, so this holds for browsers that
 * predate Fetch Metadata too, and refuses a cookie-keeping client (a link scanner that parses the page)
 * that sends none. When the browser does send Fetch Metadata, the request must also be a same-origin
 * top-level navigation into a document: `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`. That
 * stops a background `fetch()` (`cors`/`empty`) and a submission into a frame. A scripted
 * `form.submit()` sends no button, so no `action`, and is refused by the form parser below.
 *
 * `Sec-Fetch-User` is not required: Safari sends the other Fetch Metadata headers but never this one
 * (WebKit bug 247697), so requiring it refused every Safari user. What that leaves open is a script on
 * this origin calling the button's `click()`, and such a script already acts with the user's full rights.
 */
const isDeliberateSubmission = (request: Request): boolean => {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const deliberate =
    origin !== null &&
    ACCEPTED_ORIGINS.has(origin) &&
    (fetchSite === null ||
      (fetchSite === "same-origin" &&
        request.headers.get("sec-fetch-mode") === "navigate" &&
        request.headers.get("sec-fetch-dest") === "document"));

  if (!deliberate) {
    // Enough to tell a misconfigured public URL from a script or a scanner; none of it is secret.
    logger.warn(
      {
        origin,
        fetchSite,
        fetchMode: request.headers.get("sec-fetch-mode"),
        fetchDest: request.headers.get("sec-fetch-dest"),
      },
      "Refused an SSO recovery confirmation that was not a same-origin form submission"
    );
  }

  return deliberate;
};

/** Each button names its action; anything else, including no action at all, is refused rather than linked. */
const ZSubmission = z.object({
  state: z.string().min(1),
  action: z.enum(["link", "cancel"]),
});

type TSubmission = z.infer<typeof ZSubmission>;

const readSubmission = async (request: Request): Promise<TSubmission | null> => {
  try {
    const form = await request.formData();
    const parsed = ZSubmission.safeParse({ state: form.get("state"), action: form.get("action") });
    return parsed.success ? parsed.data : null;
  } catch (error) {
    // `formData()` rejects with a TypeError for a body that is not form data; that is a bad request,
    // not a fault. Anything else is unexpected and propagates.
    if (error instanceof TypeError) return null;
    throw error;
  }
};

/** The proof has done its job (the recovery was linked or cancelled), so nothing reads it again. */
const clearProofCookie = (response: NextResponse) => {
  response.cookies.set({
    name: SSO_RECOVERY_PROOF_COOKIE_NAME,
    value: "",
    ...SSO_RECOVERY_PROOF_COOKIE_OPTIONS,
    maxAge: 0,
  });
};

/** The response to a refused link or cancel; `getSsoRecoveryRefusal` decides where and at what cost. */
const buildRefusalResponse = async (request: Request, error: unknown) => {
  if (!(error instanceof SsoRecoveryError)) {
    logger.error({ ...loggableError(error) }, "Unexpected error completing SSO recovery");
  }

  const refusal = getSsoRecoveryRefusal(error);
  if (!refusal.revokesSession) {
    return NextResponse.redirect(refusal.redirectUrl, 303);
  }

  return await buildFailedRecoveryResponse(request, refusal.redirectUrl);
};

const postHandler = async (request: Request) => {
  if (!isDeliberateSubmission(request)) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
  }

  const submission = await readSubmission(request);

  if (!submission) {
    return NextResponse.redirect(getSsoRecoveryFailureRedirectUrl(), 303);
  }

  const cookieHeader = request.headers.get("cookie");
  const recoveryProof =
    (cookieHeader && getCookieValueFromHeader(cookieHeader, SSO_RECOVERY_PROOF_COOKIE_NAME)) || undefined;

  try {
    const session = await getSession();

    if (submission.action === "cancel") {
      await cancelSsoRecovery({
        stateId: submission.state,
        recoveryProof,
        sessionUserId: session?.user.id,
      });
      const response = NextResponse.redirect(WEBAPP_URL, 303);
      clearProofCookie(response);
      return response;
    }

    const callbackUrl = await completeSsoRecovery({
      stateId: submission.state,
      // Set when this browser opened the emailed link (ENG-7310).
      recoveryProof,
      sessionUserId: session?.user.id,
      // Spared by the post-commit session sweep, so the redirect below still lands signed in.
      sessionToken: getSessionTokenFromCookieHeader(cookieHeader) ?? undefined,
    });

    // 303, not the default 307: a 307 would replay this POST against the callback.
    const response = NextResponse.redirect(callbackUrl, 303);
    clearProofCookie(response);
    return response;
  } catch (error) {
    return await buildRefusalResponse(request, error);
  }
};

export const GET = withAuthRequestBodyLimit(getHandler);
export const POST = withAuthRequestBodyLimit(postHandler);
