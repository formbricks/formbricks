"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { InvalidInputError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { type SecurityActionAudit, runSecurityAction } from "@/modules/auth/lib/security-action-audit";
import { securityActionClient } from "@/modules/auth/lib/security-action-client";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ZCreateEmailTokenAction = z.object({
  email: ZUserEmail,
});

export const createEmailTokenAction = securityActionClient("email_token_issue")
  .inputSchema(ZCreateEmailTokenAction)
  .action(async ({ parsedInput, ctx }) => {
    const audit: SecurityActionAudit = {
      operation: "email_token_issue",
      action: "jwtTokenCreated",
      source: "server-action",
      requestId: ctx.auditLoggingCtx.eventId,
    };
    return runSecurityAction(audit, async () => {
      // Unauthenticated: it answers "is this email registered?" for any address the caller names, so it
      // needs the same throttling as the other auth endpoints that expose that signal.
      await applyIPRateLimit(rateLimitConfigs.auth.emailToken);

      const normalizedEmail = parsedInput.email.toLowerCase();
      const user = await getUserByEmail(normalizedEmail);
      if (!user) {
        throw new InvalidInputError("Invalid request");
      }

      audit.target = { type: "user", id: user.id };
      const token = createEmailToken(user.email);
      audit.changes = {
        tokenIssued: true,
        tokenFingerprint: `sha256:${createHash("sha256").update(token).digest("hex")}`,
      };
      return token;
    });
  });
