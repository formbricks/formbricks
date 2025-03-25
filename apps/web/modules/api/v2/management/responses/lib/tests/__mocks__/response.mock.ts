import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { Organization, Response } from "@prisma/client";

export const responseInput: Omit<Response, "id"> = {
  surveyId: "lygo31gfsexlr4lh6rq8dxyl",
  displayId: "cgt5e6dw1vsf1bv2ki5gj845",
  finished: true,
  data: { key: "value" },
  language: "en",
  meta: {},
  singleUseId: "c9471238-d6c5-42b4-bd13-00e4d0360586",
  variables: {},
  ttc: { sample: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  endingId: "lowzqpqnmjbmjowvth1u87wp",
  contactAttributes: {},
  contactId: null,
};

export const responseInputNotFinished: Omit<Response, "id"> = {
  surveyId: "lygo31gfsexlr4lh6rq8dxyl",
  displayId: "cgt5e6dw1vsf1bv2ki5gj845",
  finished: false,
  data: { key: "value" },
  language: "en",
  meta: {},
  singleUseId: "c9471238-d6c5-42b4-bd13-00e4d0360586",
  variables: {},
  ttc: { sample: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  endingId: "lowzqpqnmjbmjowvth1u87wp",
  contactAttributes: {},
  contactId: null,
};

export const responseInputWithoutTtc: Omit<Response, "id"> = {
  surveyId: "lygo31gfsexlr4lh6rq8dxyl",
  displayId: "cgt5e6dw1vsf1bv2ki5gj845",
  finished: false,
  data: { key: "value" },
  language: "en",
  meta: {},
  singleUseId: "c9471238-d6c5-42b4-bd13-00e4d0360586",
  variables: {},
  ttc: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  endingId: "lowzqpqnmjbmjowvth1u87wp",
  contactAttributes: {},
  contactId: null,
};

export const responseInputWithoutDisplay: Omit<Response, "id"> = {
  surveyId: "lygo31gfsexlr4lh6rq8dxyl",
  displayId: null,
  finished: false,
  data: { key: "value" },
  language: "en",
  meta: {},
  singleUseId: "c9471238-d6c5-42b4-bd13-00e4d0360586",
  variables: {},
  ttc: { sample: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  endingId: "lowzqpqnmjbmjowvth1u87wp",
  contactAttributes: {},
  contactId: null,
};

export const response: Response = {
  id: "bauptoqxslg42k7axss0q146",
  ...responseInput,
};

export const environmentId = "ou9sjm7a7qnilxhhhfszct95";
export const organizationId = "qybv4vk77pw71vnq9rmfrsvi";

export const organizationBilling: Organization["billing"] = {
  stripeCustomerId: "cus_P78901234567890123456789",
  plan: "free",
  period: "monthly",
  limits: {
    monthly: { responses: 100, miu: 1000 },
    projects: 1,
  },
  periodStart: new Date(),
};

export const responseFilter: TGetResponsesFilter = {
  limit: 10,
  skip: 0,
  sortBy: "createdAt",
  order: "asc",
};
