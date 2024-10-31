import { NotionWrapper } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/NotionWrapper";
import { getTranslations } from "next-intl/server";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationNotion, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const t = await getTranslations();
  const enabled = !!(
    NOTION_OAUTH_CLIENT_ID &&
    NOTION_OAUTH_CLIENT_SECRET &&
    NOTION_AUTH_URL &&
    NOTION_REDIRECT_URI
  );
  const [surveys, notionIntegration, environment, attributeClasses] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "notion"),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  let databasesArray: TIntegrationNotionDatabase[] = [];
  if (notionIntegration && (notionIntegration as TIntegrationNotion).config.key?.bot_id) {
    databasesArray = await getNotionDatabases(environment.id);
  }
  const locale = await findMatchingLocale();

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={"environments.integrations.notion.notion_integration"} />
      <NotionWrapper
        enabled={enabled}
        surveys={surveys}
        environment={environment}
        notionIntegration={notionIntegration as TIntegrationNotion}
        webAppUrl={WEBAPP_URL}
        databasesArray={databasesArray}
        attributeClasses={attributeClasses}
        locale={locale}
      />
    </PageContentWrapper>
  );
};

export default Page;
