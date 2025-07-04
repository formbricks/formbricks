"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdAction } from "@/modules/survey/list/actions";
import { TSurvey as TSurveyList } from "@/modules/survey/list/types/surveys";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";

export const useSingleUseId = (survey: TSurvey | TSurveyList) => {
  const [singleUseId, setSingleUseId] = useState<string | undefined>(undefined);

  const refreshSingleUseId = useCallback(async () => {
    if (survey.singleUse?.enabled) {
      const response = await generateSingleUseIdAction({
        surveyId: survey.id,
        isEncrypted: !!survey.singleUse?.isEncrypted,
      });
      if (response?.data) {
        setSingleUseId(response.data);
        return response.data;
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
