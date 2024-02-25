import SlackWrapper from "@/app/(app)/environments/[environmentId]/integrations/slack/SlackWrapper";

import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSlackChannels } from "@formbricks/lib/slack/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import GoBackButton from "@formbricks/ui/GoBackButton";

export default async function Slack({ params }) {
  const enabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);

  const [surveys, integrations, environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);

  const slackIntegration: TIntegrationSlack | undefined = integrations?.find(
    (integration): integration is TIntegrationSlack => integration.type === "slack"
  );

  let channelsArray: TIntegrationItem[] = [];
  if (slackIntegration && slackIntegration.config.key) {
    channelsArray = await getSlackChannels(params.environmentId);
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  console.log("isadfafd conneeeeeeected!!!!!!!!", slackIntegration);

  return (
    <>
      <GoBackButton url={`"/environments/${params.environmentId}/integrations`} />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          enabled={enabled}
          environment={environment}
          channelsArray={channelsArray}
          surveys={surveys}
          slackIntegration={slackIntegration}
          webAppUrl={WEBAPP_URL}
        />
      </div>
    </>
  );
}
