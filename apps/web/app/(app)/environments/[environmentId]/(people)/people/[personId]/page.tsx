import { AttributesSection } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/AttributesSection";
import { DeletePersonButton } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/DeletePersonButton";
import { ResponseSection } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/ResponseSection";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getPerson } from "@formbricks/lib/person/service";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const [environment, environmentTags, product, session, organization, person, attributes, attributeClasses] =
    await Promise.all([
      getEnvironment(params.environmentId),
      getTagsByEnvironmentId(params.environmentId),
      getProductByEnvironmentId(params.environmentId),
      getServerSession(authOptions),
      getOrganizationByEnvironmentId(params.environmentId),
      getPerson(params.personId),
      getAttributes(params.personId),
      getAttributeClasses(params.environmentId),
    ]);

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!person) {
    throw new Error(t("common.person_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  const getDeletePersonButton = () => {
    return (
      <DeletePersonButton environmentId={environment.id} personId={params.personId} isReadOnly={isReadOnly} />
    );
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={getPersonIdentifier(person, attributes)} cta={getDeletePersonButton()} />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-4">
          <AttributesSection personId={params.personId} />
          <ResponseSection
            environment={environment}
            personId={params.personId}
            environmentTags={environmentTags}
            attributeClasses={attributeClasses}
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};

export default Page;
