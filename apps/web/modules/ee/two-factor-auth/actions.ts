"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "./lib/two-factor-auth";

const ZSetupTwoFactorAuthAction = z.object({
  password: z.string(),
});

export const setupTwoFactorAuthAction = authenticatedActionClient.schema(ZSetupTwoFactorAuthAction).action(
  withAuditLogging(
    "updated",
    "twoFactorAuth",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
      if (!isTwoFactorAuthEnabled) {
        throw new OperationNotAllowedError("Two factor auth is not available on your instance");
      }
      const result = await setupTwoFactorAuth(ctx.user.id, parsedInput.password);
      ctx.auditLoggingCtx.userId = ctx.user.id;
      ctx.auditLoggingCtx.newObject = { twoFactorAuth: "setup" };
      return result;
    }
  )
);

const ZEnableTwoFactorAuthAction = z.object({
  code: z.string(),
});

export const enableTwoFactorAuthAction = authenticatedActionClient.schema(ZEnableTwoFactorAuthAction).action(
  withAuditLogging(
    "updated",
    "twoFactorAuth",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
      if (!isTwoFactorAuthEnabled) {
        throw new OperationNotAllowedError("Two factor auth is not available on your instance");
      }
      const result = await enableTwoFactorAuth(ctx.user.id, parsedInput.code);
      ctx.auditLoggingCtx.userId = ctx.user.id;
      ctx.auditLoggingCtx.newObject = { twoFactorAuth: "enabled" };
      return result;
    }
  )
);

const ZDisableTwoFactorAuthAction = z
  .object({
    code: z.string().optional(),
    password: z.string(),
    backupCode: z.string().optional(),
  })
  .refine(
    (data) => data.password !== undefined || data.code !== undefined,
    "Please provide either the code or the backup code"
  );

export const disableTwoFactorAuthAction = authenticatedActionClient
  .schema(ZDisableTwoFactorAuthAction)
  .action(
    withAuditLogging(
      "updated",
      "twoFactorAuth",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZDisableTwoFactorAuthAction>;
      }) => {
        const result = await disableTwoFactorAuth(ctx.user.id, parsedInput);
        ctx.auditLoggingCtx.userId = ctx.user.id;
        ctx.auditLoggingCtx.newObject = { twoFactorAuth: "disabled" };
        return result;
      }
    )
  );
