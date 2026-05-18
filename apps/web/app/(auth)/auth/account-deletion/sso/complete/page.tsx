import { redirect } from "next/navigation";
import { completeAccountDeletionSsoIdentityConfirmationAndGetRedirectPath } from "./lib/account-deletion-sso-complete";

export default async function AccountDeletionSsoConfirmationCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  redirect(await completeAccountDeletionSsoIdentityConfirmationAndGetRedirectPath(await searchParams));
}
