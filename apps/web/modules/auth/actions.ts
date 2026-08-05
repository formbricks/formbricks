"use server";

import { z } from "zod";
import { InvalidInputError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { actionClient } from "@/lib/utils/action-client";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ZCreateEmailTokenAction = z.object({
  email: ZUserEmail,
});

export const createEmailTokenAction = actionClient
  .inputSchema(ZCreateEmailTokenAction)
  .action(async ({ parsedInput }) => {
    // Unauthenticated: it answers "is this email registered?" for any address the caller names, so it
    // needs the same throttling as the other auth endpoints that expose that signal.
    await applyIPRateLimit(rateLimitConfigs.auth.emailToken);

    const normalizedEmail = parsedInput.email.toLowerCase();
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      throw new InvalidInputError("Invalid request");
    }

    return createEmailToken(user.email);
  });
