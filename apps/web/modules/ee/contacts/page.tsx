import { authOptions } from "@/modules/auth/lib/authOptions";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys, getContacts } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-actions";
import { UserIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
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
  const initialContacts = await getContacts(params.environmentId, 0);

  const AddContactsButton = (
    <UploadContactsCSVButton environmentId={environment.id} contactAttributeKeys={contactAttributeKeys} />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Contacts" cta={isContactsEnabled && !isReadOnly ? AddContactsButton : undefined}>
        <ContactsSecondaryNavigation activeId="contacts" environmentId={params.environmentId} />
      </PageHeader>

      {isContactsEnabled ? (
        <ContactDataView
          key={initialContacts.length + contactAttributeKeys.length}
          environment={environment}
          itemsPerPage={ITEMS_PER_PAGE}
          contactAttributeKeys={contactAttributeKeys}
          isReadOnly={isReadOnly}
          initialContacts={initialContacts}
          hasMore={initialContacts.length <= ITEMS_PER_PAGE}
        />
      ) : (
        <div className="flex items-center justify-center">
          <UpgradePrompt
            icon={<UserIcon className="h-6 w-6 text-slate-900" />}
            title="Unlock contacts with a higher plan"
            description="Manage contacts and send out targeted surveys"
            buttons={[
              { text: "Upgrade now", href: `/environments/${environment.id}/settings/billing` },
              { text: "Learn more", href: `/environments/${environment.id}/settings/billing` },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
