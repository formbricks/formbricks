import { redirect } from "next/navigation";
import { TIntegrationSlack } from "@formbricks/types/integration/slack";
import { getSurveys } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/lib/surveys";
import { SlackWrapper } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/slack/components/SlackWrapper";
import { DEFAULT_LOCALE, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@/lib/constants";
import { getIntegrationByType } from "@/lib/integration/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const isEnabled = !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);

  const t = await getTranslate();

  const { isReadOnly, session, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [surveys, slackIntegration, locale] = await Promise.all([
    getSurveys(workspace.id),
    getIntegrationByType(workspace.id, "slack"),
    getUserLocale(session.user.id),
  ]);

  if (isReadOnly) {
    return redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/workspaces/${params.workspaceId}/integrations`} />
      <PageHeader pageTitle={t("workspace.integrations.slack.slack_integration")} />
      <div className="h-[75vh] w-full">
        <SlackWrapper
          isEnabled={isEnabled}
          workspaceId={workspace.id}
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
