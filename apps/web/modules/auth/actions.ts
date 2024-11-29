"use server";

import { actionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { createEmailToken } from "@formbricks/lib/jwt";
import { getUserByEmail } from "@formbricks/lib/user/service";
import { InvalidInputError } from "@formbricks/types/errors";

const ZCreateEmailTokenAction = z.object({
  email: z.string().min(5).max(255).email({ message: "Invalid email" }),
});

export const createEmailTokenAction = actionClient
  .schema(ZCreateEmailTokenAction)
  .action(async ({ parsedInput }) => {
    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new InvalidInputError("Invalid request");
    }

    return createEmailToken(parsedInput.email);
  });
