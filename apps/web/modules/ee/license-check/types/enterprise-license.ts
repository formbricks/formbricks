import { z } from "zod";

const ZEnterpriseLicenseStatus = z.enum(["active", "expired"]);

export type TEnterpriseLicenseStatus = z.infer<typeof ZEnterpriseLicenseStatus>;

const ZEnterpriseLicenseFeatures = z.object({
  isMultiOrgEnabled: z.boolean(),
  contacts: z.boolean(),
  projects: z.number().nullable(),
  whitelabel: z.boolean(),
  removeBranding: z.boolean(),
  twoFactorAuth: z.boolean(),
  sso: z.boolean(),
  saml: z.boolean(),
  spamProtection: z.boolean(),
  ai: z.boolean(),
});

export type TEnterpriseLicenseFeatures = z.infer<typeof ZEnterpriseLicenseFeatures>;

export const ZEnterpriseLicenseDetails = z.object({
  status: ZEnterpriseLicenseStatus,
  features: ZEnterpriseLicenseFeatures,
});

export type TEnterpriseLicenseDetails = z.infer<typeof ZEnterpriseLicenseDetails>;
