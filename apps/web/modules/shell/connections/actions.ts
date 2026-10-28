"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertCan } from "@/lib/authorization";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZRevokeOAuthConnectionAction = z.object({
  id: z.string().min(1),
  /** The organization whose Agent connections page the person revoked from; the audit event lands in its trail. */
  organizationId: ZId,
});

/**
 * Revokes one of the signed-in person's OAuth consents. `deleteOAuthConsent` is wrapped by
 * `revokeOAuthConsentBeforeHandler` (modules/auth/lib/oauth-grant-revocation.ts), so this ends the app's
 * refresh tokens as well, not just the consent row. Better Auth resolves the consent against the session,
 * which is why a consent that belongs to someone else cannot be revoked here. Moved from the old
 * authorized-apps settings page; API keys are revoked with `deleteApiKeyAction`.
 *
 * A consent belongs to the person, not an organization, so the audit event is filed under the
 * organization the person acted from, once they are shown to be able to read it.
 */
export const revokeOAuthConnectionAction = authenticatedActionClient
  .inputSchema(ZRevokeOAuthConnectionAction)
  .action(
    withAuditLogging("deleted", "oauthConsent", async ({ ctx, parsedInput }) => {
      await assertCan({ type: "user", id: ctx.user.id }, "organization.read_access", {
        type: "organization",
        id: parsedInput.organizationId,
      });

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.oauthConsentId = parsedInput.id;

      await auth.api.deleteOAuthConsent({
        body: { id: parsedInput.id },
        headers: await headers(),
      });

      revalidatePath("/organizations/[organizationId]/connections", "page");

      return { success: true };
    })
  );
