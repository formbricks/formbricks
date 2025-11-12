import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdsAction } from "@/modules/survey/list/actions";
import type { TSurvey as TSurveyList } from "@/modules/survey/list/types/surveys";

export const useSingleUseId = (survey: TSurvey | TSurveyList, isReadOnly: boolean) => {
  const [singleUseId, setSingleUseId] = useState<string>();

  const refreshSingleUseId = useCallback(async (): Promise<string | undefined> => {
    if (isReadOnly || !survey.singleUse?.enabled) {
      // If read‑only or singleUse disabled, just clear and bail out
      setSingleUseId(undefined);
      return undefined;
    }

    const response = await generateSingleUseIdsAction({
      surveyId: survey.id,
      isEncrypted: Boolean(survey.singleUse?.isEncrypted),
      count: 1,
    });

    if (response?.data?.length) {
      setSingleUseId(response.data[0]);
      return response.data[0];
    } else {
      toast.error(getFormattedErrorMessage(response));
      return undefined;
    }
  }, [survey, isReadOnly]);

  return {
    singleUseId: isReadOnly ? undefined : singleUseId,
    refreshSingleUseId: isReadOnly ? async () => undefined : refreshSingleUseId,
  };
};
