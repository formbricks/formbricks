"use server";

import { z } from "zod";
import { InvalidInputError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { actionClient } from "@/lib/utils/action-client";

const ZCreateEmailTokenAction = z.object({
  email: ZUserEmail,
});

export const createEmailTokenAction = actionClient
  .inputSchema(ZCreateEmailTokenAction)
  .action(async ({ parsedInput }) => {
    const normalizedEmail = parsedInput.email.toLowerCase();
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      throw new InvalidInputError("Invalid request");
    }

    return createEmailToken(user.email);
  });
