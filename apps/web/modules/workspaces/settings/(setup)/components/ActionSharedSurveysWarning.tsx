"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { getActiveInactiveSurveysAction } from "@/modules/workspaces/settings/(setup)/app-connection/actions";

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
      const response = await getActiveInactiveSurveysAction({
        actionClassId,
        excludeSurveyId: currentSurveyId,
      });

      if (response?.data) {
        setOtherSurveyNames([...response.data.activeSurveys, ...response.data.inactiveSurveys]);
        return;
      }

      setOtherSurveyNames([]);
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
