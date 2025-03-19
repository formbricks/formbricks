import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { SlackWrapper } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/SlackWrapper";
import { getEnvironmentAuth } from "@/modules/environments/lib/fetcher";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { redirect } from "next/navigation";
import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";

const Page = async (props) => {
  const params = await props.params;
  const isEnabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);

  const t = await getTranslate();

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [surveys, slackIntegration] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "slack"),
  ]);

  const locale = await findMatchingLocale();

  if (isReadOnly) {
    redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.slack.slack_integration")} />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          isEnabled={isEnabled}
          environment={environment}
          surveys={surveys}
          slackIntegration={slackIntegration as TIntegrationSlack}
          webAppUrl={WEBAPP_URL}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
