import NotionWrapper from "@/app/(app)/environments/[environmentId]/integrations/notion/NotionWrapper";
import GoBackButton from "@/app/components/shared/GoBackButton";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TNotionDatabase, TNotionIntegration } from "@formbricks/types/v1/integrations";

export default async function Notion({ params }) {
  const enabled = !!(
    NOTION_OAUTH_CLIENT_ID &&
    NOTION_OAUTH_CLIENT_SECRET &&
    NOTION_AUTH_URL &&
    NOTION_REDIRECT_URI
  );
  const [surveys, integrations, environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  const notionIntegration: TNotionIntegration | undefined = integrations?.find(
    (integration): integration is TNotionIntegration => integration.type === "notion"
  );

  let databasesArray: TNotionDatabase[] = [];
  if (notionIntegration && notionIntegration.config.key?.bot_id) {
    databasesArray = await getNotionDatabases(environment.id);
  }

  return (
    <>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <NotionWrapper
        enabled={enabled}
        surveys={surveys}
        environment={environment}
        notionIntegration={notionIntegration}
        webAppUrl={WEBAPP_URL}
        databasesArray={databasesArray}
      />
    </>
  );
}
