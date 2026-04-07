import { redirect } from "next/navigation";
import { TIntegrationNotion, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { getSurveys } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/lib/surveys";
import { NotionWrapper } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/notion/components/NotionWrapper";
import {
  DEFAULT_LOCALE,
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@/lib/constants";
import { getIntegrationByType } from "@/lib/integration/service";
import { getNotionDatabases } from "@/lib/notion/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const enabled = !!(
    NOTION_OAUTH_CLIENT_ID &&
    NOTION_OAUTH_CLIENT_SECRET &&
    NOTION_AUTH_URL &&
    NOTION_REDIRECT_URI
  );

  const { isReadOnly, environment, session, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [surveys, notionIntegration, locale] = await Promise.all([
    getSurveys(workspace.id),
    getIntegrationByType(workspace.id, "notion"),
    getUserLocale(session.user.id),
  ]);

  let databasesArray: TIntegrationNotionDatabase[] = [];
  if (notionIntegration && (notionIntegration as TIntegrationNotion).config.key?.bot_id) {
    databasesArray = (await getNotionDatabases(workspace.id)) ?? [];
  }

  if (isReadOnly) {
    return redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={"./"} />
      <PageHeader pageTitle={t("environments.integrations.notion.notion_integration")} />
      <NotionWrapper
        enabled={enabled}
        surveys={surveys}
        workspaceId={workspace.id}
        notionIntegration={notionIntegration as TIntegrationNotion}
        webAppUrl={WEBAPP_URL}
        databasesArray={databasesArray}
        locale={locale ?? DEFAULT_LOCALE}
      />
    </PageContentWrapper>
  );
};

export default Page;
