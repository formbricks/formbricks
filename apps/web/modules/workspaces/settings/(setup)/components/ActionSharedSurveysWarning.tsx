"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { getActionClassSurveys } from "@/modules/workspaces/settings/(setup)/app-connection/lib/api-client";

interface ActionSharedSurveysWarningProps {
  actionClassId: string;
  currentSurveyId: string;
}

export const ActionSharedSurveysWarning = ({
  actionClassId,
  currentSurveyId,
}: Readonly<ActionSharedSurveysWarningProps>) => {
  const { t } = useTranslation();
  const [otherSurveyNames, setOtherSurveyNames] = useState<string[] | null>(null);

  useEffect(() => {
    const fetchOtherSurveys = async () => {
      try {
        const surveys = await getActionClassSurveys(actionClassId, currentSurveyId);
        setOtherSurveyNames([...surveys.activeSurveys, ...surveys.inactiveSurveys]);
      } catch (error) {
        toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
        setOtherSurveyNames([]);
      }
    };

    void fetchOtherSurveys();
  }, [actionClassId, currentSurveyId]);

  if (!otherSurveyNames?.length) {
    return null;
  }

  return (
    <Alert variant="warning">
      <AlertTitle>{t("workspace.actions.edit_shared_action_warning_title")}</AlertTitle>
      <AlertDescription>
        {t("workspace.actions.edit_shared_action_warning_description", {
          surveys: otherSurveyNames.join(", "),
        })}
      </AlertDescription>
    </Alert>
  );
};
