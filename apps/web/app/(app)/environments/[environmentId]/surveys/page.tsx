export const revalidate = REVALIDATION_INTERVAL;

import { updateEnvironmentAction } from "@/app/(app)/environments/[environmentId]/settings/setup/actions";
import ContentWrapper from "@/components/shared/ContentWrapper";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getActionsByEnvironmentId } from "@formbricks/lib/services/actions";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { Metadata } from "next";
import SurveysList from "./SurveyList";

export const metadata: Metadata = {
  title: "Your Surveys",
};

export default async function SurveysPage({ params }) {
  const [environment, actions] = await Promise.all([
    getEnvironment(params.environmentId),
    getActionsByEnvironmentId(params.environmentId),
  ]);

  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      <SurveysList environmentId={params.environmentId} />
      {environment && (
        <WidgetStatusIndicator
          environment={environment}
          actions={actions}
          type="mini"
          updateEnvironmentAction={updateEnvironmentAction}
        />
      )}
    </ContentWrapper>
  );
}
