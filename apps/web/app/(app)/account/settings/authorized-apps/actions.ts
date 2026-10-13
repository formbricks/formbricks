"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZRevokeOAuthConsentAction = z.object({
  id: z.string().min(1),
});

export const revokeOAuthConsentAction = authenticatedActionClient
  .inputSchema(ZRevokeOAuthConsentAction)
  .action(
    withAuditLogging("deleted", "user", async ({ ctx, parsedInput }) => {
      // Account-level: the consent belongs to the user, not to an organization.
      ctx.auditLoggingCtx.userId = ctx.user.id;

      await auth.api.deleteOAuthConsent({
        body: { id: parsedInput.id },
        headers: await headers(),
      });

      // Only newObject: a diff against an old snapshot would drop the unchanged consent id.
      ctx.auditLoggingCtx.newObject = { oauthConsentId: parsedInput.id, oauthConsentRevoked: true };
      revalidatePath("/account/settings/authorized-apps");

      return { success: true };
    })
  );
