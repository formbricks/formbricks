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

export const organizationEnvironments = {
  projects: [
    {
      environments: [{ id: "w6pljnz4l9ljgmyl51xv8ah8" }, { id: "v5sfypq4ib6vjelccho23lmn" }],
    },
    { environments: [{ id: "ffbv7bmhs52yd8beebu6be2l" }] },
  ],
};

export const environmentIds = [
  "w6pljnz4l9ljgmyl51xv8ah8",
  "v5sfypq4ib6vjelccho23lmn",
  "ffbv7bmhs52yd8beebu6be2l",
];
