import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { generateSingleUseLinks } from "@/modules/survey/list/lib/api-client";
import type { TSurvey as TSurveyList } from "@/modules/survey/list/types/surveys";

export const useSingleUseId = (survey: TSurvey | TSurveyList, isReadOnly: boolean) => {
  const { t } = useTranslation();
  const [singleUseLinkParams, setSingleUseLinkParams] = useState<TSurveySingleUseLinkParams>();

  const refreshSingleUseId = useCallback(async (): Promise<TSurveySingleUseLinkParams | undefined> => {
    if (isReadOnly || !survey.singleUse?.enabled) {
      // If read‑only or singleUse disabled, just clear and bail out
      setSingleUseLinkParams(undefined);
      return undefined;
    }

    try {
      const [link] = await generateSingleUseLinks({
        surveyId: survey.id,
        isEncrypted: Boolean(survey.singleUse?.isEncrypted),
        count: 1,
      });
      setSingleUseLinkParams(link);
      return link;
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      return undefined;
    }
  }, [survey, isReadOnly, t]);

  return {
    singleUseId: isReadOnly ? undefined : singleUseLinkParams?.suId,
    singleUseToken: isReadOnly ? undefined : singleUseLinkParams?.suToken,
    refreshSingleUseId: isReadOnly ? async () => undefined : refreshSingleUseId,
  };
};
