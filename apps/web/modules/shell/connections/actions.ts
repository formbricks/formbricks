"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";

const ZRevokeOAuthConnectionAction = z.object({
  id: z.string().min(1),
});

/**
 * Revokes one of the signed-in person's OAuth consents. `deleteOAuthConsent` is wrapped by
 * `revokeOAuthConsentBeforeHandler` (modules/auth/lib/oauth-grant-revocation.ts), so this ends the app's
 * refresh tokens as well, not just the consent row. Better Auth resolves the consent against the session,
 * which is why a consent that belongs to someone else cannot be revoked here. Moved from the old
 * authorized-apps settings page; API keys are revoked with `deleteApiKeyAction`.
 */
export const revokeOAuthConnectionAction = authenticatedActionClient
  .inputSchema(ZRevokeOAuthConnectionAction)
  .action(async ({ parsedInput }) => {
    await auth.api.deleteOAuthConsent({
      body: { id: parsedInput.id },
      headers: await headers(),
    });

    revalidatePath("/organizations/[organizationId]/connections", "page");

    return { success: true };
  });
