import { redirect } from "next/navigation";
import { completeAccountDeletionSsoReauthenticationAndGetRedirectPath } from "./lib/account-deletion-sso-complete";

export default async function AccountDeletionSsoReauthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  redirect(await completeAccountDeletionSsoReauthenticationAndGetRedirectPath(await searchParams));
}
