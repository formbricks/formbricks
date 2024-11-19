"use server";

import { actionClient } from "@/lib/utils/action-client";
import { sendForgotPasswordEmail } from "@/modules/email";
import { z } from "zod";
import { getUserByEmail } from "@formbricks/lib/user/service";

const ZForgotPasswordAction = z.object({
  email: z.string().max(255).email({ message: "Invalid email" }),
});

export const forgotPasswordAction = actionClient
  .schema(ZForgotPasswordAction)
  .action(async ({ parsedInput }) => {
    const user = await getUserByEmail(parsedInput.email);
    if (user) {
      await sendForgotPasswordEmail(user, user.locale);
    }
  });
