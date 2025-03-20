import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { NotionWrapper } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/NotionWrapper";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { redirect } from "next/navigation";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationNotion, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const enabled = !!(
    NOTION_OAUTH_CLIENT_ID &&
    NOTION_OAUTH_CLIENT_SECRET &&
    NOTION_AUTH_URL &&
    NOTION_REDIRECT_URI
  );

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [surveys, notionIntegration] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "notion"),
  ]);

  let databasesArray: TIntegrationNotionDatabase[] = [];
  if (notionIntegration && (notionIntegration as TIntegrationNotion).config.key?.bot_id) {
    databasesArray = (await getNotionDatabases(environment.id)) ?? [];
  }
  const locale = await findMatchingLocale();

  if (isReadOnly) {
    redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.notion.notion_integration")} />
      <NotionWrapper
        enabled={enabled}
        surveys={surveys}
        environment={environment}
        notionIntegration={notionIntegration as TIntegrationNotion}
        webAppUrl={WEBAPP_URL}
        databasesArray={databasesArray}
        locale={locale}
      />
    </PageContentWrapper>
  );
};

export default Page;
