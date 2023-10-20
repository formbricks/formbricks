import z from "zod";

const ZRole = z.enum(["project_manager", "engineer", "founder", "marketing_specialist", "other"]);

export const ZProfileObjective = z.enum([
  "increase_conversion",
  "improve_user_retention",
  "increase_user_adoption",
  "sharpen_marketing_messaging",
  "support_sales",
  "other",
]);

export type TProfileObjective = z.infer<typeof ZProfileObjective>;

export const ZProfile = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  twoFactorEnabled: z.boolean(),
  identityProvider: z.enum(["email", "google", "github", "azuread"]),
  createdAt: z.date(),
  updatedAt: z.date(),
  onboardingCompleted: z.boolean(),
});

export type TProfile = z.infer<typeof ZProfile>;

export const ZProfileUpdateInput = z.object({
  name: z.string().nullish(),
  email: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
  role: ZRole.optional(),
  objective: ZProfileObjective.optional(),
});

export type TProfileUpdateInput = z.infer<typeof ZProfileUpdateInput>;

export const ZProfileCreateInput = z.object({
  name: z.string().optional(),
  email: z.string(),
  onboardingCompleted: z.boolean().optional(),
  role: ZRole.optional(),
  objective: ZProfileObjective.optional(),
});

export type TProfileCreateInput = z.infer<typeof ZProfileCreateInput>;
