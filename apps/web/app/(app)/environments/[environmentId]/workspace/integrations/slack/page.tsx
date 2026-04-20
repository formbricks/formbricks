import { redirect } from "next/navigation";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import { getSurveys } from "@/app/(app)/environments/[environmentId]/workspace/integrations/lib/surveys";
import { SlackWrapper } from "@/app/(app)/environments/[environmentId]/workspace/integrations/slack/components/SlackWrapper";
import { DEFAULT_LOCALE, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@/lib/constants";
import { getIntegrationByType } from "@/lib/integration/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const isEnabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);

  const t = await getTranslate();

  const { isReadOnly, environment, session } = await getEnvironmentAuth(params.environmentId);

  const [surveys, slackIntegration, locale] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "slack"),
    getUserLocale(session.user.id),
  ]);

  if (isReadOnly) {
    return redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/workspace/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.slack.slack_integration")} />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          isEnabled={isEnabled}
          environment={environment}
          surveys={surveys}
          slackIntegration={slackIntegration as TIntegrationSlack}
          webAppUrl={WEBAPP_URL}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
