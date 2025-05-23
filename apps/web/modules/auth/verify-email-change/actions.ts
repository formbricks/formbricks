"use server";

import { verifyEmailChangeToken } from "@/lib/jwt";
import { actionClient } from "@/lib/utils/action-client";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { updateUser } from "@/modules/auth/lib/user";
import { z } from "zod";

export const verifyEmailChangeAction = actionClient
  .schema(z.object({ token: z.string() }))
  .action(async ({ parsedInput }) => {
    const { id, email } = await verifyEmailChangeToken(parsedInput.token);

    if (!email) {
      throw new Error("Email not found in token");
    }
    const user = await updateUser(id, { email, emailVerified: new Date() });
    if (!user) {
      throw new Error("User not found or email update failed");
    }
    updateBrevoCustomer({ id: user.id, email: user.email });
    return user;
  });
