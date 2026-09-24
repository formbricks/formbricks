import { TOrganizationBilling } from "@formbricks/types/organizations";

export const organizationId = "zo6u7apbattt8dquvzbgjjwb";
export const workspaceId = "oh5cq6yu418itha55vsuj47e";

export const organizationBilling: TOrganizationBilling = {
  stripeCustomerId: "cus_P78901234567890123456789",
  limits: {
    monthly: { responses: 100 },
    workspaces: 1,
  },
  usageCycleAnchor: new Date(),
};
