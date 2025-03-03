import { ActionClassesTable } from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import { ActionClassDataRow } from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import { ActionTableHeading } from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";

export const metadata: Metadata = {
  title: "Actions",
};

const Page = async (props) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const t = await getTranslate();
  const [actionClasses, organization, project] = await Promise.all([
    getActionClasses(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
  ]);
  const locale = await findMatchingLocale();

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const environments = await getEnvironments(project.id);
  const currentEnvironment = environments.find((env) => env.id === params.environmentId);

  if (!currentEnvironment) {
    throw new Error(t("common.environment_not_found"));
  }

  const otherEnvironment = environments.filter((env) => env.id !== params.environmentId)[0];

  const otherEnvActionClasses = await getActionClasses(otherEnvironment.id);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember, isBilling } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session?.user.id, project.id);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const isReadOnly = isMember && hasReadAccess;

  const renderAddActionButton = () => (
    <AddActionModal
      environmentId={params.environmentId}
      actionClasses={actionClasses}
      isReadOnly={isReadOnly}
    />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.actions")} cta={!isReadOnly ? renderAddActionButton() : undefined} />
      <ActionClassesTable
        environment={currentEnvironment}
        otherEnvironment={otherEnvironment}
        otherEnvActionClasses={otherEnvActionClasses}
        environmentId={params.environmentId}
        actionClasses={actionClasses}
        isReadOnly={isReadOnly}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} locale={locale} />
        ))}
      </ActionClassesTable>
    </PageContentWrapper>
  );
};

export default Page;
