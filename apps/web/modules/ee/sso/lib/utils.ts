import { redactPII } from "@/modules/ee/audit-logs/lib/utils";
import type { Account } from "next-auth";
import { TUser } from "@formbricks/types/user";

export const getCallbackUrl = (inviteUrl?: string, source?: string) => {
  return inviteUrl
    ? `${inviteUrl}${inviteUrl.includes("?") ? "&" : "?"}source=${source}`
    : `/?source=${source}`;
};

const sanitizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Remove sensitive parameters
    urlObj.searchParams.delete("token");
    urlObj.searchParams.delete("code");
    urlObj.searchParams.delete("state");
    return urlObj.pathname + (urlObj.search ? `${urlObj.search}` : "");
  } catch {
    return "[invalid-url]";
  }
};
export const createDebugContext = (user: TUser, account: Account, callbackUrl?: string) => {
  const correlationId = crypto.randomUUID();

  const context = {
    correlationId,
    ...user,
    ...account,
    callbackPath: callbackUrl ? sanitizeUrl(callbackUrl) : null,
    component: "sso_handler",
  };

  return { ...redactPII(context), name: "formbricks" };
};
