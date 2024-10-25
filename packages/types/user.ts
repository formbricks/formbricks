import { z } from "zod";

const ZRole = z.enum(["project_manager", "engineer", "founder", "marketing_specialist", "other"]);

const ZLocale = z.enum(["en-US", "hi", "de-DE", "pt-BR"]);

export const ZUserObjective = z.enum([
  "increase_conversion",
  "improve_user_retention",
  "increase_user_adoption",
  "sharpen_marketing_messaging",
  "support_sales",
  "other",
]);

export type TUserObjective = z.infer<typeof ZUserObjective>;

export const ZUserNotificationSettings = z.object({
  alert: z.record(z.boolean()),
  weeklySummary: z.record(z.boolean()),
  unsubscribedOrganizationIds: z.array(z.string()).optional(),
});

export type TUserNotificationSettings = z.infer<typeof ZUserNotificationSettings>;

export const ZUser = z.object({
  id: z.string(),
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(1, { message: "Name should be at least 1 character long" }),
  email: z.string().email(),
  emailVerified: z.date().nullable(),
  imageUrl: z.string().url().nullable(),
  twoFactorEnabled: z.boolean(),
  identityProvider: z.enum(["email", "google", "github", "azuread", "openid"]),
  createdAt: z.date(),
  updatedAt: z.date(),
  role: ZRole.nullable(),
  objective: ZUserObjective.nullable(),
  notificationSettings: ZUserNotificationSettings,
  locale: z.string().refine((value) => ZLocale.safeParse(value).success, {
    message: "Invalid locale",
  }),
});

export type TUser = z.infer<typeof ZUser>;

export const ZUserUpdateInput = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  emailVerified: z.date().nullish(),
  role: ZRole.optional(),
  objective: ZUserObjective.nullish(),
  imageUrl: z.string().nullish(),
  notificationSettings: ZUserNotificationSettings.optional(),
  locale: z
    .string()
    .refine((value) => ZLocale.safeParse(value).success, {
      message: "Invalid locale",
    })
    .optional(),
});

export type TUserUpdateInput = z.infer<typeof ZUserUpdateInput>;

export const ZUserCreateInput = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(1, { message: "Name should be at least 1 character long" }),
  email: z.string().email(),
  emailVerified: z.date().optional(),
  role: ZRole.optional(),
  objective: ZUserObjective.nullish(),
  identityProvider: z.enum(["email", "google", "github", "azuread", "openid"]).optional(),
  identityProviderAccountId: z.string().optional(),
  locale: z
    .string()
    .refine((value) => ZLocale.safeParse(value).success, {
      message: "Invalid locale",
    })
    .optional(),
});

export type TUserCreateInput = z.infer<typeof ZUserCreateInput>;
