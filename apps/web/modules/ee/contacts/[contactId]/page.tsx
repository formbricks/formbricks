import { authOptions } from "@/modules/auth/lib/authOptions";
import { AttributesSection } from "@/modules/ee/contacts/[contactId]/components/attributes-section";
import { DeleteContactButton } from "@/modules/ee/contacts/[contactId]/components/delete-contact-button";
import {
  getContact,
  getContactAttributeKeys,
  getContactAttributes,
} from "@/modules/ee/contacts/lib/contacts";
import { getContactIdentifier } from "@/modules/ee/contacts/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { ResponseSection } from "./components/response-section";

export const SingleContactPage = async (props: {
  params: Promise<{ environmentId: string; contactId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslations();
  const [
    environment,
    environmentTags,
    project,
    session,
    organization,
    contact,
    contactAttributeKeys,
    contactAttributes,
  ] = await Promise.all([
    getEnvironment(params.environmentId),
    getTagsByEnvironmentId(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
    getContact(params.contactId),
    getContactAttributeKeys(params.environmentId),
    getContactAttributes(params.contactId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
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

  if (!contact) {
    throw new Error(t("common.contact_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  const getDeletePersonButton = () => {
    return (
      <DeleteContactButton
        environmentId={environment.id}
        contactId={params.contactId}
        isReadOnly={isReadOnly}
      />
    );
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={getContactIdentifier(contactAttributes)} cta={getDeletePersonButton()} />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-4 gap-x-8">
          <AttributesSection contactId={params.contactId} />
          <ResponseSection
            environment={environment}
            contactId={params.contactId}
            environmentTags={environmentTags}
            contactAttributeKeys={contactAttributeKeys}
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};
