import { z } from "zod";
import { ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { IS_TURNSTILE_CONFIGURED } from "@/lib/constants";

/**
 * Input for `createUserAction`, the only way to create a credential account (ENG-3988). Kept out of
 * actions.ts because a "use server" module may only export async functions.
 *
 * The Turnstile requirement is checked on the object, not on the field: Zod skips a field's refinements
 * when an optional value is absent, so a field-level `.refine` let a request with no `turnstileToken` at
 * all through validation. It was still stopped by the action's own guard, but as an error-level
 * "Server configuration error" instead of a validation error.
 */
export const ZCreateUserAction = z
  .object({
    name: ZUserName,
    email: ZUserEmail,
    password: ZUserPassword,
    inviteToken: z.string().optional(),
    userLocale: ZUserLocale.optional(),
    turnstileToken: z.string().optional(),
    subscribeToSecurityUpdates: z.boolean().optional(),
    subscribeToProductUpdates: z.boolean().optional(),
  })
  .refine((input) => !IS_TURNSTILE_CONFIGURED || Boolean(input.turnstileToken), {
    message: "CAPTCHA verification required",
    path: ["turnstileToken"],
  });
