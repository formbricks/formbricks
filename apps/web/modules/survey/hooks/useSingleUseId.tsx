"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdsAction } from "@/modules/survey/list/actions";
import { TSurvey as TSurveyList } from "@/modules/survey/list/types/surveys";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";

export const useSingleUseId = (survey: TSurvey | TSurveyList) => {
  const [singleUseId, setSingleUseId] = useState<string | undefined>(undefined);

  const refreshSingleUseId = useCallback(async () => {
    if (survey.singleUse?.enabled) {
      const response = await generateSingleUseIdsAction({
        surveyId: survey.id,
        isEncrypted: Boolean(survey.singleUse?.isEncrypted),
        count: 1,
      });

      if (!!response?.data?.length) {
        setSingleUseId(response.data[0]);
        return response.data[0];
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage);
        return undefined;
      }
    } else {
      setSingleUseId(undefined);
      return undefined;
    }
  }, [survey]);

  useEffect(() => {
    refreshSingleUseId();
  }, [survey, refreshSingleUseId]);

  return { singleUseId, refreshSingleUseId };
};
