import { getValidatedCallbackUrl } from "@/lib/utils/url";

const RELATIVE_URL_BASE = "http://localhost";
export const VERIFICATION_REQUEST_PURPOSES = ["email_verification", "sso_recovery"] as const;
export type TVerificationRequestPurpose = (typeof VERIFICATION_REQUEST_PURPOSES)[number];
const DEFAULT_VERIFICATION_REQUEST_PURPOSE: TVerificationRequestPurpose = "email_verification";

export const buildVerificationRequestedPath = ({
  token,
  callbackUrl,
  purpose = DEFAULT_VERIFICATION_REQUEST_PURPOSE,
}: {
  token: string;
  callbackUrl?: string | null;
  purpose?: TVerificationRequestPurpose;
}): string => {
  const verificationRequestedUrl = new URL("/auth/verification-requested", RELATIVE_URL_BASE);
  verificationRequestedUrl.searchParams.set("token", token);

  if (callbackUrl) {
    verificationRequestedUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  if (purpose !== DEFAULT_VERIFICATION_REQUEST_PURPOSE) {
    verificationRequestedUrl.searchParams.set("purpose", purpose);
  }

  return `${verificationRequestedUrl.pathname}${verificationRequestedUrl.search}`;
};

export const buildVerificationLinks = ({
  token,
  webAppUrl,
  callbackUrl,
  purpose = DEFAULT_VERIFICATION_REQUEST_PURPOSE,
  verificationRequestToken = token,
}: {
  token: string;
  webAppUrl: string;
  callbackUrl?: string | null;
  purpose?: TVerificationRequestPurpose;
  verificationRequestToken?: string;
}): { verificationRequestLink: string; verifyLink: string } => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, webAppUrl);
  // The verify link now serves only SSO recovery — email verification moved to Better Auth's native
  // flow (ENG-1054), so the legacy /auth/verify page is gone. It resolves at Better Auth's
  // /sso-recovery/sign-in endpoint, which verifies the JWT, establishes the session, and redirects to
  // callbackUrl. (`purpose` still distinguishes the verification-request link below.)
  const verifyLink = new URL("/api/auth/sso-recovery/sign-in", webAppUrl);
  verifyLink.searchParams.set("token", token);

  const verificationRequestLink = new URL("/auth/verification-requested", webAppUrl);
  verificationRequestLink.searchParams.set("token", verificationRequestToken);

  if (validatedCallbackUrl) {
    verifyLink.searchParams.set("callbackUrl", validatedCallbackUrl);
    verificationRequestLink.searchParams.set("callbackUrl", validatedCallbackUrl);
  }

  if (purpose !== DEFAULT_VERIFICATION_REQUEST_PURPOSE) {
    verificationRequestLink.searchParams.set("purpose", purpose);
  }

  return {
    verificationRequestLink: verificationRequestLink.toString(),
    verifyLink: verifyLink.toString(),
  };
};
