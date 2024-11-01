import { SlackWrapper } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/SlackWrapper";
import { getTranslations } from "next-intl/server";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { getSlackChannels } from "@formbricks/lib/slack/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const isEnabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
  const t = await getTranslations();
  const [surveys, slackIntegration, environment, attributeClasses] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "slack"),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  let channelsArray: TIntegrationItem[] = [];
  if (slackIntegration && slackIntegration.config.key) {
    channelsArray = await getSlackChannels(params.environmentId);
  }
  const locale = await findMatchingLocale();
  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={"environments.integrations.slack.slack_integration"} />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          isEnabled={isEnabled}
          environment={environment}
          channelsArray={channelsArray}
          surveys={surveys}
          slackIntegration={slackIntegration as TIntegrationSlack}
          webAppUrl={WEBAPP_URL}
          attributeClasses={attributeClasses}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
