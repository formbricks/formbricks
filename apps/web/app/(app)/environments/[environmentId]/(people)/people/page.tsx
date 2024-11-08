import { PersonDataView } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonDataView";
import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { CircleHelpIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const product = await getProductByEnvironmentId(params.environmentId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session?.user.id, product.id);

  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  const HowToAddPeopleButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      {t("environments.people.how_to_add_people")}
    </Button>
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.people")} cta={HowToAddPeopleButton}>
        <PersonSecondaryNavigation activeId="people" environmentId={params.environmentId} />
      </PageHeader>
      <PersonDataView environment={environment} itemsPerPage={ITEMS_PER_PAGE} isReadOnly={isReadOnly} />
    </PageContentWrapper>
  );
};

export default Page;
