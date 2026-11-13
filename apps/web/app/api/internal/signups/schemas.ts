import { z } from "zod";
import { ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { EMAILED_TOKEN_MAX } from "@/app/api/internal/lib/limits";
import { IS_TURNSTILE_CONFIGURED } from "@/lib/constants";

/** A user's display name at sign-up. `ZUserName` has no upper bound of its own. */
export const SIGNUP_NAME_MAX = 255;

/** A Turnstile response token. Cloudflare's are at most 2048 characters; this leaves room. */
export const TURNSTILE_TOKEN_MAX = 4096;

/**
 * `POST /api/internal/signups`: the only way to create a credential account (ENG-3988).
 *
 * The Turnstile requirement is checked on the object, not on the field: Zod skips a field's refinements
 * when an optional value is absent, so a field-level `.refine` let a request with no `turnstileToken` at
 * all through validation. It was still stopped by the operation's own guard, but as an error-level
 * "Server configuration error" instead of a validation error.
 */
export const ZSignupBody = z
  .object({
    name: ZUserName.max(SIGNUP_NAME_MAX),
    email: ZUserEmail,
    password: ZUserPassword,
    inviteToken: z.string().max(EMAILED_TOKEN_MAX).optional(),
    userLocale: ZUserLocale.optional(),
    turnstileToken: z.string().max(TURNSTILE_TOKEN_MAX).optional(),
    subscribeToSecurityUpdates: z.boolean().optional(),
    subscribeToProductUpdates: z.boolean().optional(),
  })
  .strict()
  .refine((input) => !IS_TURNSTILE_CONFIGURED || Boolean(input.turnstileToken), {
    message: "CAPTCHA verification required",
    path: ["turnstileToken"],
  });

export type TSignupBody = z.infer<typeof ZSignupBody>;
