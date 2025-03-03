import { contactCache } from "@/lib/cache/contact";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContacts } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { IS_FORMBRICKS_CLOUD, ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { ContactDataView } from "./components/contact-data-view";
import { ContactsSecondaryNavigation } from "./components/contacts-secondary-navigation";

export const ContactsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const t = await getTranslate();
  const params = await paramsProps;
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Session not found");
  }

  const isContactsEnabled = await getIsContactsEnabled();

  const [environment, product] = await Promise.all([
    getEnvironment(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
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

  const productPermission = await getProjectPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  const contactAttributeKeys = await getContactAttributeKeys(params.environmentId);
  const initialContacts = await getContacts(params.environmentId, 0);

  const AddContactsButton = (
    <UploadContactsCSVButton environmentId={environment.id} contactAttributeKeys={contactAttributeKeys} />
  );

  const refreshContacts = async () => {
    "use server";
    contactCache.revalidate({ environmentId: params.environmentId });
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("common.contacts")}
        cta={isContactsEnabled && !isReadOnly ? AddContactsButton : undefined}>
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
          hasMore={initialContacts.length >= ITEMS_PER_PAGE}
          refreshContacts={refreshContacts}
        />
      ) : (
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("environments.contacts.unlock_contacts_title")}
            description={t("environments.contacts.unlock_contacts_description")}
            buttons={[
              {
                text: t("common.start_free_trial"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/environments/${params.environmentId}/settings/billing`
                  : "https://formbricks.com/upgrade-self-hosting-license",
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/environments/${params.environmentId}/settings/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
