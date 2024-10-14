"use client";

import { generateInsightsForSurveyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { needsInsightsGeneration } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { ArrowUpRightFromSquareIcon, SparklesIcon, SquarePenIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { Badge } from "@formbricks/ui/components/Badge";
import { Button } from "@formbricks/ui/components/Button";

export const SurveyAnalysisCTA = ({
  survey,
  environment,
  isViewer,
  webAppUrl,
  user,
  surveyResponseCount,
}: {
  survey: TSurvey;
  environment: TEnvironment;
  isViewer: boolean;
  webAppUrl: string;
  user: TUser;
  surveyResponseCount: number;
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const shouldGenerateInsights = needsInsightsGeneration(survey);

  const [showShareSurveyModal, setShowShareSurveyModal] = useState(searchParams.get("share") === "true");
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const widgetSetupCompleted = environment.appSetupCompleted;

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

  const handleInsightGeneration = async () => {
    setIsGeneratingInsights(true);
    await generateInsightsForSurveyAction({ surveyId: survey.id });
    setIsGeneratingInsights(false);
  };

  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {shouldGenerateInsights && (
        <Button
          variant="secondary"
          EndIcon={SparklesIcon}
          onClick={handleInsightGeneration}
          loading={isGeneratingInsights}
          disabled={surveyResponseCount > 10000}
          tooltip={
            surveyResponseCount > 10000
              ? "Kindly contact us at hola@formbricks.com to generate insights for this survey"
              : undefined
          }>
          Generate insights
        </Button>
      )}
      {survey.resultShareKey && (
        <Badge text="Results are public" type="warning" size="normal" className="rounded-lg"></Badge>
      )}
      {(widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" ? (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      ) : null}
      {survey.type === "link" && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpenShareSurveyModal(true);
            }}
            EndIcon={ArrowUpRightFromSquareIcon}>
            Preview
          </Button>
        </>
      )}
      {!isViewer && (
        <Button
          size="sm"
          className="h-full"
          href={`/environments/${environment.id}/surveys/${survey.id}/edit`}
          EndIcon={SquarePenIcon}>
          Edit
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
