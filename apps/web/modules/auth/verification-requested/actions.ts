"use server";

import { actionClient } from "@/lib/utils/action-client";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { sendVerificationEmail } from "@/modules/email";
import { z } from "zod";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";

const ZResendVerificationEmailAction = z.object({
  email: ZUserEmail,
});

export const resendVerificationEmailAction = actionClient
  .schema(ZResendVerificationEmailAction)
  .action(async ({ parsedInput }) => {
    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new ResourceNotFoundError("user", parsedInput.email);
    }
    if (user.emailVerified) {
      throw new InvalidInputError("Email address has already been verified");
    }
    return await sendVerificationEmail(user);
  });
