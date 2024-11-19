"use server";

import { actionClient } from "@/lib/utils/action-client";
import { sendPasswordResetNotifyEmail } from "@/modules/email";
import { z } from "zod";
import { hashPassword } from "@formbricks/lib/auth";
import { verifyToken } from "@formbricks/lib/jwt";
import { getUser, updateUser } from "@formbricks/lib/user/service";
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
    if (user) {
      const updatedUser = await updateUser(id, { password: hashedPassword });
      await sendPasswordResetNotifyEmail(updatedUser);
    }
  });
