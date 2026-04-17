import { getValidatedCallbackUrl } from "@/lib/utils/url";

const RELATIVE_URL_BASE = "http://localhost";

export const buildVerificationRequestedPath = ({
  token,
  callbackUrl,
}: {
  token: string;
  callbackUrl?: string | null;
}): string => {
  const verificationRequestedUrl = new URL("/auth/verification-requested", RELATIVE_URL_BASE);
  verificationRequestedUrl.searchParams.set("token", token);

  if (callbackUrl) {
    verificationRequestedUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return `${verificationRequestedUrl.pathname}${verificationRequestedUrl.search}`;
};

export const buildVerificationLinks = ({
  token,
  webAppUrl,
  callbackUrl,
}: {
  token: string;
  webAppUrl: string;
  callbackUrl?: string | null;
}): { verificationRequestLink: string; verifyLink: string } => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, webAppUrl);
  const verifyLink = new URL("/auth/verify", webAppUrl);
  verifyLink.searchParams.set("token", token);

  const verificationRequestLink = new URL("/auth/verification-requested", webAppUrl);
  verificationRequestLink.searchParams.set("token", token);

  if (validatedCallbackUrl) {
    verifyLink.searchParams.set("callbackUrl", validatedCallbackUrl);
    verificationRequestLink.searchParams.set("callbackUrl", validatedCallbackUrl);
  }

  return {
    verificationRequestLink: verificationRequestLink.toString(),
    verifyLink: verifyLink.toString(),
  };
};
