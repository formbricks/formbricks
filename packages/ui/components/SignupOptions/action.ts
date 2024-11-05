"use server";

import { z } from "zod";
import { actionClient } from "@formbricks/lib/actionClient";
import { createEmailToken } from "@formbricks/lib/jwt";
import { getUserByEmail } from "@formbricks/lib/user/service";

const ZCreateEmailTokenAction = z.object({
  email: z.string(),
});

export const createEmailTokenAction = actionClient
  .schema(ZCreateEmailTokenAction)
  .action(async ({ parsedInput }) => {
    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new Error("User not found");
    }
    return createEmailToken(parsedInput.email);
  });
