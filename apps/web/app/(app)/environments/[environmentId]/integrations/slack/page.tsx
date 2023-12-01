import GoBackButton from "@/components/shared/GoBackButton";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getSlackChannels } from "@formbricks/lib/slack/service";
import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { TSlackChannel, TSlackIntegration } from "@formbricks/types/v1/integrations";
import SlackWrapper from "@/app/(app)/environments/[environmentId]/integrations/slack/SlackWrapper";

export default async function Slack({ params }) {
  const enabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);

  const [surveys, integrations, environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);

  const slackIntegration: TSlackIntegration | undefined = integrations?.find(
    (integration): integration is TSlackIntegration => integration.type === "slack"
  );

  let channelArray: TSlackChannel[] = [];
  if (slackIntegration && slackIntegration.config.key) {
    channelArray = await getSlackChannels(params.environmentId);
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <>
      <GoBackButton url={`"/environments/${params.environmentId}/integrations`} />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          enabled={enabled}
          environment={environment}
          channels={channelArray}
          surveys={surveys}
          slackIntegration={slackIntegration}
          webAppUrl={WEBAPP_URL}
          environmentId={params.environmentId}
        />
      </div>
    </>
  );
}
