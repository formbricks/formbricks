import { z } from "zod";

export const ZUserLocale = z.enum([
  "de-DE",
  "en-US",
  "es-ES",
  "fr-FR",
  "hu-HU",
  "ja-JP",
  "nl-NL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sv-SE",
  "tr-TR",
  "zh-Hans-CN",
  "zh-Hant-TW",
]);

export type TUserLocale = z.infer<typeof ZUserLocale>;

export const ZUserNotificationSettings = z.object({
  alert: z.record(z.string(), z.boolean()),
  unsubscribedOrganizationIds: z.array(z.string()).optional(),
});

// Characters allowed in a user's display name: letters, combining marks, space, and common name
// punctuation — apostrophe, comma, period, ampersand, parentheses, digits, hyphen. `.` and `&` were
// added for ENG-1743 so ordinary names ("J. Smith", "Smith & Co") validate instead of being rejected.
// Declared once so the validator (ZUserName) and the normalizer (normalizeUserName) can never diverge:
// every string normalizeUserName produces is guaranteed to satisfy ZUserName. `-` stays last so it is
// a literal, not a range.
const USER_NAME_ALLOWED_CHARS = "\\p{L}\\p{M} ',.&()\\d-";

export const ZUserName = z
  .string()
  .trim()
  .min(1, {
    error: "Name should be at least 1 character long",
  })
  .regex(new RegExp(`^[${USER_NAME_ALLOWED_CHARS}]+$`, "u"), "Invalid name format");

/**
 * Normalize an untrusted display name (e.g. an SSO identity-provider name) into a value that always
 * satisfies {@link ZUserName}: characters outside the allowlist collapse to a single space, internal
 * whitespace is collapsed, and the result is trimmed. External IdP names are untrusted input, so we
 * sanitize them to fit the model rather than rejecting the sign-in (ENG-1743). Returns "" when nothing
 * survives (e.g. a name of only emoji); callers should fall back to another source such as the email
 * local-part.
 */
export const normalizeUserName = (name: string): string =>
  name
    .replace(new RegExp(`[^${USER_NAME_ALLOWED_CHARS}]+`, "gu"), " ")
    .replace(/\s+/gu, " ")
    .trim();

export const ZUserEmail = z
  .email({
    error: "Invalid email",
  })
  .max(255);

export type TUserEmail = z.infer<typeof ZUserEmail>;

export const ZUserPassword = z
  .string()
  .min(8, {
    error: "Password must be at least 8 characters long",
  })
  .max(128, {
    error: "Password must be 128 characters or less",
  })
  .regex(/^(?=.*[A-Z])(?=.*\d).*$/);

export type TUserPassword = z.infer<typeof ZUserPassword>;

export type TUserNotificationSettings = z.infer<typeof ZUserNotificationSettings>;

const ZUserIdentityProvider = z.enum(["email", "google", "github", "azuread", "openid", "saml"]);

export const ZUser = z.object({
  id: z.string(),
  name: ZUserName,
  email: ZUserEmail,
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  identityProvider: ZUserIdentityProvider,
  createdAt: z.date(),
  updatedAt: z.date(),
  notificationSettings: ZUserNotificationSettings,
  locale: ZUserLocale,
  lastLoginAt: z.date().nullable(),
  isActive: z.boolean().prefault(true),
});

export type TUser = z.infer<typeof ZUser>;

export const ZUserUpdateInput = z.object({
  name: ZUserName.optional(),
  email: ZUserEmail.optional(),
  emailVerified: z.boolean().optional(),
  password: ZUserPassword.optional(),
  notificationSettings: ZUserNotificationSettings.optional(),
  locale: ZUserLocale.optional(),
  lastLoginAt: z.date().nullish(),
  isActive: z.boolean().optional(),
});

export type TUserUpdateInput = z.infer<typeof ZUserUpdateInput>;

export const ZUserCreateInput = z.object({
  name: ZUserName,
  email: ZUserEmail,
  password: ZUserPassword.optional(),
  emailVerified: z.boolean().optional(),
  identityProvider: ZUserIdentityProvider.optional(),
  identityProviderAccountId: z.string().optional(),
  locale: ZUserLocale.optional(),
});

export type TUserCreateInput = z.infer<typeof ZUserCreateInput>;

export const ZUserPersonalInfoUpdateInput = ZUserUpdateInput.pick({
  name: true,
  email: true,
  locale: true,
}).extend({
  password: ZUserPassword.optional(),
});

export type TUserPersonalInfoUpdateInput = z.infer<typeof ZUserPersonalInfoUpdateInput>;
