"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { ShareIcon, SquarePenIcon } from "lucide-react";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";
import { TUser } from "@formbricks/types/user";
import { Badge } from "@formbricks/ui/Badge";
import { Button } from "@formbricks/ui/Button";

export const SurveyAnalysisCTA = ({
  survey,
  environment,
  isViewer,
  webAppUrl,
  user,
}: {
  survey: TSurvey;
  environment: TEnvironment;
  isViewer: boolean;
  webAppUrl: string;
  user: TUser;
}) => {
  const [showShareSurveyModal, setShowShareSurveyModal] = useState(false);

  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {survey.resultShareKey && (
        <Badge text="Results are public" type="warning" size="normal" className="rounded-lg"></Badge>
      )}
      {(environment.widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" ? (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      ) : null}
      {survey.type === "link" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShowShareSurveyModal(true);
          }}>
          <ShareIcon className="h-5 w-5" />
        </Button>
      )}
      {!isViewer && (
        <Button
          variant="darkCTA"
          size="sm"
          className="h-full w-full px-3"
          href={`/environments/${environment.id}/surveys/${survey.id}/edit`}>
          Edit
          <SquarePenIcon className="ml-1 h-4" />
        </Button>
      )}
      {showShareSurveyModal && user && (
        <ShareEmbedSurvey
          survey={survey}
          open={showShareSurveyModal}
          setOpen={setShowShareSurveyModal}
          webAppUrl={webAppUrl}
          user={user}
        />
      )}

      {user && <SuccessMessage environment={environment} survey={survey} webAppUrl={webAppUrl} user={user} />}
    </div>
  );
};
