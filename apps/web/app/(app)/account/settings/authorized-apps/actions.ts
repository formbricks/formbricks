"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/modules/auth/lib/auth";
import { securityActionClient } from "@/modules/auth/lib/security-action-client";

const ZRevokeOAuthConsentAction = z.object({
  id: z.string().min(1),
});

export const revokeOAuthConsentAction = securityActionClient("oauth2/delete-consent", "oauthConsent")
  .inputSchema(ZRevokeOAuthConsentAction)
  .action(async ({ parsedInput }) => {
    // Native auth verifies the session and consent ownership, and audits rejected API calls too.
    await auth.api.deleteOAuthConsent({
      body: { id: parsedInput.id },
      headers: await headers(),
    });

    revalidatePath("/account/settings/authorized-apps");

    return { success: true };
  });
