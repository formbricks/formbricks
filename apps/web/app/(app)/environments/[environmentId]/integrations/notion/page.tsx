import { NotionWrapper } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/NotionWrapper";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrationByType } from "@formbricks/lib/integration/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationNotion, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const enabled = !!(
    NOTION_OAUTH_CLIENT_ID &&
    NOTION_OAUTH_CLIENT_SECRET &&
    NOTION_AUTH_URL &&
    NOTION_REDIRECT_URI
  );
  const [session, surveys, notionIntegration, environment, attributeClasses] = await Promise.all([
    getServerSession(authOptions),
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "notion"),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const product = await getProductByEnvironmentId(params.environmentId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  let databasesArray: TIntegrationNotionDatabase[] = [];
  if (notionIntegration && (notionIntegration as TIntegrationNotion).config.key?.bot_id) {
    databasesArray = await getNotionDatabases(environment.id);
  }
  const locale = await findMatchingLocale();

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    product.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session?.user.id, environment?.productId);

  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

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
        attributeClasses={attributeClasses}
        locale={locale}
      />
    </PageContentWrapper>
  );
};

export default Page;
