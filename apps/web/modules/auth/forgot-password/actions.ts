"use server";

import { actionClient } from "@/lib/utils/action-client";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { sendForgotPasswordEmail } from "@/modules/email";
import { z } from "zod";

const ZForgotPasswordAction = z.object({
  email: z.string().max(255).email({ message: "Invalid email" }),
});

export const forgotPasswordAction = actionClient
  .schema(ZForgotPasswordAction)
  .action(async ({ parsedInput }) => {
    const user = await getUserByEmail(parsedInput.email);
    if (user) {
      await sendForgotPasswordEmail(user);
    }
    return { success: true };
  });
