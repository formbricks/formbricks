"use server";

import { actionClient } from "@/lib/utils/action-client/action-client";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { sendForgotPasswordEmail } from "@/modules/email";
import { z } from "zod";
import { ZUserEmail } from "@formbricks/types/user";

const ZForgotPasswordAction = z.object({
  email: ZUserEmail,
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
