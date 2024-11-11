import { ActionClassesTable } from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import { ActionClassDataRow } from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import { ActionTableHeading } from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

export const metadata: Metadata = {
  title: "Actions",
};

const Page = async ({ params }) => {
  const session = await getServerSession(authOptions);
  const t = await getTranslations();
  const [actionClasses, organization, product] = await Promise.all([
    getActionClasses(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);
  const locale = findMatchingLocale();

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const environment = await getEnvironment(params.environmentId);

  if (!environment?.productId) {
    throw new Error(t("common.environment_not_found"));
  }

  const environments = await getEnvironments(environment.productId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember, isBilling } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session?.user.id, product.id);

  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

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
        environment={environment}
        environments={environments}
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
