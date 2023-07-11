"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";
import { useEnvironment } from "@/lib/environments/environments";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ErrorComponent } from "@formbricks/ui";

interface StatusDropdownProps {
  survey: TSurvey;
  environmentId: string;
}

export default function StatusDropdown({ survey, environmentId }: StatusDropdownProps) {
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorEnvironment) {
    return <ErrorComponent />;
  }

  return (
    <>
      {environment.widgetSetupCompleted || survey.type === "link" ? (
        <SurveyStatusDropdown surveyId={survey.id} environmentId={environmentId} />
      ) : null}
    </>
  );
}
