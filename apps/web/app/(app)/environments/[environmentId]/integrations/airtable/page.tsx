import { AirtableWrapper } from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper";
import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAirtableTables } from "@formbricks/lib/airtable/service";
import { AIRTABLE_CLIENT_ID, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const isEnabled = !!AIRTABLE_CLIENT_ID;
  const [session, surveys, integrations, environment] = await Promise.all([
    getServerSession(authOptions),
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  const project = await getProjectByEnvironmentId(params.environmentId);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const airtableIntegration: TIntegrationAirtable | undefined = integrations?.find(
    (integration): integration is TIntegrationAirtable => integration.type === "airtable"
  );

  let airtableArray: TIntegrationItem[] = [];
  if (airtableIntegration && airtableIntegration.config.key) {
    airtableArray = await getAirtableTables(params.environmentId);
  }

  const locale = await findMatchingLocale();

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    project.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session?.user.id, environment?.projectId);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  if (isReadOnly) {
    redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.airtable.airtable_integration")} />
      <div className="h-[75vh] w-full">
        <AirtableWrapper
          isEnabled={isEnabled}
          airtableIntegration={airtableIntegration}
          airtableArray={airtableArray}
          environmentId={environment.id}
          surveys={surveys}
          environment={environment}
          webAppUrl={WEBAPP_URL}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
