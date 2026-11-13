import type { TSurveyQuota, TSurveyQuotaLogic } from "@formbricks/types/quota";

/** A survey quota, as the survey editor's quota card lists and edits it. */
export type TQuotaResource = {
  id: string;
  surveyId: string;
  name: string;
  limit: number;
  logic: TSurveyQuotaLogic;
  action: TSurveyQuota["action"];
  endingCardId: string | null;
  countPartialSubmissions: boolean;
};

export const serializeQuota = (quota: TSurveyQuota): TQuotaResource => ({
  id: quota.id,
  surveyId: quota.surveyId,
  name: quota.name,
  limit: quota.limit,
  logic: quota.logic,
  action: quota.action,
  endingCardId: quota.endingCardId,
  countPartialSubmissions: quota.countPartialSubmissions,
});

/** How many responses a quota has screened in, which its new limit may not go below. */
export type TQuotaResponseCountResource = { quotaId: string; count: number };
