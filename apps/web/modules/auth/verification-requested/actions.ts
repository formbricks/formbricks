"use server";

import { actionClient } from "@/lib/utils/action-client";
import { sendVerificationEmail } from "@/modules/email";
import { z } from "zod";
import { getUserByEmail } from "@formbricks/lib/user/service";

const ZResendVerificationEmailAction = z.object({
  email: z.string().max(255).email({ message: "Invalid email" }),
});

export const resendVerificationEmailAction = actionClient
  .schema(ZResendVerificationEmailAction)
  .action(async ({ parsedInput }) => {
    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new Error("No user with this email address found");
    }
    if (user.emailVerified) {
      throw new Error("Email address has already been verified");
    }
    await sendVerificationEmail(user);
  });
