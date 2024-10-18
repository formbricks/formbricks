import { SlackWrapper } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/SlackWrapper";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const isEnabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);

  const [surveys, slackIntegration, environment, attributeClasses] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "slack"),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle="Slack Integration" />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          isEnabled={isEnabled}
          environment={environment}
          surveys={surveys}
          slackIntegration={slackIntegration as TIntegrationSlack}
          webAppUrl={WEBAPP_URL}
          attributeClasses={attributeClasses}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
