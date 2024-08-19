"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { ShareIcon, SquarePenIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [showShareSurveyModal, setShowShareSurveyModal] = useState(searchParams.get("share") === "true");

  const widgetSetupCompleted =
    survey.type === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted;

  useEffect(() => {
    if (searchParams.get("share") === "true") {
      setShowShareSurveyModal(true);
    } else {
      setShowShareSurveyModal(false);
    }
  }, [searchParams]);

  const setOpenShareSurveyModal = (open: boolean) => {
    const searchParams = new URLSearchParams(window.location.search);

    if (open) {
      searchParams.set("share", "true");
      setShowShareSurveyModal(true);
    } else {
      searchParams.delete("share");
      setShowShareSurveyModal(false);
    }

    router.push(`${pathname}?${searchParams.toString()}`);
  };
  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {survey.resultShareKey && (
        <Badge text="Results are public" type="warning" size="normal" className="rounded-lg"></Badge>
      )}
      {(widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" ? (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      ) : null}
      {survey.type === "link" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setOpenShareSurveyModal(true);
          }}>
          <ShareIcon className="h-5 w-5" />
        </Button>
      )}
      {!isViewer && (
        <Button
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
          setOpen={setOpenShareSurveyModal}
          webAppUrl={webAppUrl}
          user={user}
        />
      )}

      {user && <SuccessMessage environment={environment} survey={survey} />}
    </div>
  );
};
