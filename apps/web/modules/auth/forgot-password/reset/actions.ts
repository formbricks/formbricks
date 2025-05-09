"use server";

import { hashPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt";
import { actionClient } from "@/lib/utils/action-client";
import { updateUser } from "@/modules/auth/lib/user";
import { getUser } from "@/modules/auth/lib/user";
import { sendPasswordResetNotifyEmail } from "@/modules/email";
import { z } from "zod";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserPassword } from "@formbricks/types/user";

const ZResetPasswordAction = z.object({
  token: z.string(),
  password: ZUserPassword,
});

export const resetPasswordAction = actionClient
  .schema(ZResetPasswordAction)
  .action(async ({ parsedInput }) => {
    const hashedPassword = await hashPassword(parsedInput.password);
    const { id } = await verifyToken(parsedInput.token);
    const user = await getUser(id);
    if (!user) {
      throw new ResourceNotFoundError("user", id);
    }
    const updatedUser = await updateUser(id, { password: hashedPassword });
    await sendPasswordResetNotifyEmail(updatedUser);
    return { success: true };
  });
