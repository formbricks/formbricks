import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { CircleHelpIcon } from "lucide-react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { AttributeClassesTable } from "./components/AttributeClassesTable";

export const metadata: Metadata = {
  title: "Attributes",
};

const Page = async (props) => {
  const params = await props.params;
  let attributeClasses = await getAttributeClasses(params.environmentId);
  const t = await getTranslations();
  const project = await getProjectByEnvironmentId(params.environmentId);
  const locale = await findMatchingLocale();
  if (!project) {
    throw new Error(t("common.product_not_found"));
  }

  const [organization, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  const HowToAddAttributesButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification#setting-custom-user-attributes"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      {t("environments.attributes.how_to_add_attributes")}
    </Button>
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.people")} cta={HowToAddAttributesButton}>
        <PersonSecondaryNavigation activeId="attributes" environmentId={params.environmentId} />
      </PageHeader>
      <AttributeClassesTable attributeClasses={attributeClasses} locale={locale} isReadOnly={isReadOnly} />
    </PageContentWrapper>
  );
};

export default Page;
