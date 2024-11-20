import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { ContactDataView } from "./components/contact-data-view";
import { ContactsSecondaryNavigation } from "./components/contacts-secondary-navigation";

export const ContactsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const t = await getTranslations();
  const params = await paramsProps;
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Session not found");
  }

  const isContactsEnabled = await getIsContactsEnabled();
  if (!isContactsEnabled) {
    notFound();
  }

  const [environment, product] = await Promise.all([
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    product.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  const contactAttributeKeys = await getContactAttributeKeys(params.environmentId);

  const HowToAddPeopleButton = (
    <UploadContactsCSVButton environmentId={environment.id} contactAttributeKeys={contactAttributeKeys} />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Contacts" cta={HowToAddPeopleButton}>
        <ContactsSecondaryNavigation activeId="contacts" environmentId={params.environmentId} />
      </PageHeader>
      <ContactDataView
        environment={environment}
        itemsPerPage={ITEMS_PER_PAGE}
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};
