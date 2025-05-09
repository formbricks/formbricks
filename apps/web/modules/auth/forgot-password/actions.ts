"use server";

import { PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { sendForgotPasswordEmail } from "@/modules/email";
import { z } from "zod";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";

const ZForgotPasswordAction = z.object({
  email: ZUserEmail,
});

export const forgotPasswordAction = actionClient
  .schema(ZForgotPasswordAction)
  .action(async ({ parsedInput }) => {
    if (PASSWORD_RESET_DISABLED) {
      throw new OperationNotAllowedError("Password reset is disabled");
    }

    const user = await getUserByEmail(parsedInput.email);

    if (!user) {
      throw new ResourceNotFoundError("user", parsedInput.email);
    }

    if (user.identityProvider !== "email") {
      throw new OperationNotAllowedError("Password reset is not allowed for SSO users");
    }

    await sendForgotPasswordEmail(user);

    return { success: true };
  });
