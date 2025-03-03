"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "./lib/two-factor-auth";

const ZSetupTwoFactorAuthAction = z.object({
  password: z.string(),
});

export const setupTwoFactorAuthAction = authenticatedActionClient
  .schema(ZSetupTwoFactorAuthAction)
  .action(async ({ parsedInput, ctx }) => {
    const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
    if (!isTwoFactorAuthEnabled) {
      throw new OperationNotAllowedError("Two factor auth is not available on your instance");
    }
    return await setupTwoFactorAuth(ctx.user.id, parsedInput.password);
  });

const ZEnableTwoFactorAuthAction = z.object({
  code: z.string(),
});

export const enableTwoFactorAuthAction = authenticatedActionClient
  .schema(ZEnableTwoFactorAuthAction)
  .action(async ({ parsedInput, ctx }) => {
    const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
    if (!isTwoFactorAuthEnabled) {
      throw new OperationNotAllowedError("Two factor auth is not available on your instance");
    }
    return await enableTwoFactorAuth(ctx.user.id, parsedInput.code);
  });

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
  .action(async ({ parsedInput, ctx }) => {
    return await disableTwoFactorAuth(ctx.user.id, parsedInput);
  });
