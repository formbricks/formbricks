"use server";

import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { actionClient } from "@/lib/utils/action-client/action-client";
import { z } from "zod";
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
