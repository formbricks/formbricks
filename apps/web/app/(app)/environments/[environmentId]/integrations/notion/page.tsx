import { NotionWrapper } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/NotionWrapper";
import { getServerSession } from "next-auth";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import {
  DEFAULT_LOCALE,
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
import { getUserLocale } from "@formbricks/lib/user/service";
import { TIntegrationNotion, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
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
    throw new Error("Environment not found");
  }

  let databasesArray: TIntegrationNotionDatabase[] = [];
  if (notionIntegration && (notionIntegration as TIntegrationNotion).config.key?.bot_id) {
    databasesArray = await getNotionDatabases(environment.id);
  }
  const session = await getServerSession(authOptions);
  const locale = session?.user.id ? await getUserLocale(session.user.id) : undefined;

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
        locale={locale ?? DEFAULT_LOCALE}
      />
    </PageContentWrapper>
  );
};

export default Page;
