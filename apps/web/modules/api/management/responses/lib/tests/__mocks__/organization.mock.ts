import { Organization } from "@prisma/client";

export const organizationId = "zo6u7apbattt8dquvzbgjjwb";
export const environmentId = "oh5cq6yu418itha55vsuj47e";

export const organizationBilling: Organization["billing"] = {
  stripeCustomerId: "cus_P78901234567890123456789",
  plan: "scale",
  period: "monthly",
  limits: {
    monthly: { responses: 100, miu: 1000 },
    projects: 1,
  },
  periodStart: new Date(),
};
export const environmentIds = ["f6vr01g4dyv7rjbs1is0zl5w", "p8s7jicf7tb508nf58tdla7o"];
