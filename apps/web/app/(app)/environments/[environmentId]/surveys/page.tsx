export const revalidate = REVALIDATION_INTERVAL;

import ContentWrapper from "@/components/shared/ContentWrapper";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import SurveysList from "./SurveyList";
import { Metadata } from "next";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getActions } from "@formbricks/lib/services/actions";
import { updateEnvironmentAction } from "@/app/(app)/environments/[environmentId]/settings/setup/actions";

export const metadata: Metadata = {
  title: "Your Surveys",
};

export default async function SurveysPage({ params }) {
  const [environment, events] = await Promise.all([
    getEnvironment(params.environmentId),
    getActions(params.environmentId),
  ]);

  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      <SurveysList environmentId={params.environmentId} />
      {environment && (
        <WidgetStatusIndicator
          environment={environment}
          events={events}
          type="mini"
          updateEnvironmentAction={updateEnvironmentAction}
        />
      )}
    </ContentWrapper>
  );
}
