import { TSurveyQuota, TSurveyQuotaAction } from "@formbricks/types/quota";

type QuotaFull =
  | {
      quotaFull: true;
      quota: {
        id: string;
        action: TSurveyQuotaAction;
        endingCardId?: string;
      };
    }
  | {
      quotaFull: false;
    };

export const createQuotaFullObject = (quota?: TSurveyQuota): QuotaFull => {
  if (!quota) return { quotaFull: false };

  return {
    quotaFull: true,
    quota: {
      id: quota.id,
      action: quota.action,
      ...(quota.endingCardId ? { endingCardId: quota.endingCardId } : {}),
    },
  };
};
