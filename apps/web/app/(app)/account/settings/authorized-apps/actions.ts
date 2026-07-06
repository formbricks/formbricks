"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";

const ZRevokeOAuthConsentAction = z.object({
  id: z.string().min(1),
});

export const revokeOAuthConsentAction = authenticatedActionClient
  .inputSchema(ZRevokeOAuthConsentAction)
  .action(async ({ parsedInput }) => {
    await auth.api.deleteOAuthConsent({
      body: { id: parsedInput.id },
      headers: await headers(),
    });

    revalidatePath("/account/settings/authorized-apps");

    return { success: true };
  });
