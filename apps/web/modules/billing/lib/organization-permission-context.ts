import type { Organization } from "@prisma/client";

export type TOrganizationPermissionContext = {
  organizationId: string;
  billingPlan: Organization["billing"]["plan"];
};
