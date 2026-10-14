"use server";

import { z } from "zod";
import { InvalidInputError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { actionClient } from "@/lib/utils/action-client";
import { logAuthEvent, shouldLogAuthFailure } from "@/modules/auth/lib/utils";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

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
      // Unauthenticated and attacker-controlled input, so the failure is throttled and the actor is the
      // hashed address (logAuthEvent), never the raw email.
      if (await shouldLogAuthFailure(normalizedEmail)) {
        logAuthEvent("jwtTokenCreated", "failure", UNKNOWN_DATA, normalizedEmail, {
          provider: "token",
          authMethod: "email_token",
          failureReason: "user_not_found",
        });
      }
      throw new InvalidInputError("Invalid request");
    }

    const token = createEmailToken(user.email);
    logAuthEvent("jwtTokenCreated", "success", user.id, user.email, {
      provider: "token",
      authMethod: "email_token",
    });
    return token;
  });
