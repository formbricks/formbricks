import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getTagsByWorkspaceId } from "@/lib/tag/service";
import { getTranslate } from "@/lingodotdev/server";
import { AttributesSection } from "@/modules/ee/contacts/[contactId]/components/attributes-section";
import { ContactControlBar } from "@/modules/ee/contacts/[contactId]/components/contact-control-bar";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContactAttributesWithKeyInfo } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContactAuth } from "@/modules/ee/contacts/lib/contact-auth";
import { getContactInWorkspace } from "@/modules/ee/contacts/lib/contacts";
import { getPublishedLinkSurveys } from "@/modules/ee/contacts/lib/surveys";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ActivitySection } from "./components/activity-section";

export const SingleContactPage = async (props: {
  params: Promise<{ workspaceId: string; contactId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  // Ties the contact in the URL to the workspace in the URL: authorizing the workspace alone would
  // let any authenticated user read a foreign contact's PII through their own workspace.
  const { isReadOnly, organization, workspace } = await getContactAuth(params.workspaceId, params.contactId);

  const [environmentTags, contact, publishedLinkSurveys, attributesWithKeyInfo, allAttributeKeys] =
    await Promise.all([
      getTagsByWorkspaceId(workspace.id),
      getContactInWorkspace(params.contactId, workspace.id),
      getPublishedLinkSurveys(workspace.id),
      getContactAttributesWithKeyInfo(params.contactId, workspace.id),
      getContactAttributeKeys(workspace.id),
    ]);

  if (!contact) {
    throw new ResourceNotFoundError(t("common.contact"), params.contactId);
  }

  const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

  // Derive contact identifier from metadata array
  const getAttributeValue = (key: string): string | undefined => {
    return attributesWithKeyInfo.find((attr) => attr.key === key)?.value;
  };

  const contactIdentifier = getAttributeValue("email") || getAttributeValue("userId") || "";

  const getContactControlBar = () => {
    return (
      <ContactControlBar
        contactId={params.contactId}
        isReadOnly={isReadOnly}
        isQuotasAllowed={isQuotasAllowed}
        publishedLinkSurveys={publishedLinkSurveys}
        currentAttributes={attributesWithKeyInfo}
        allAttributeKeys={allAttributeKeys}
      />
    );
  };

  return (
    <PageContentWrapper>
      <GoBackButton url={`/workspaces/${workspace.id}/contacts`} />
      <PageHeader pageTitle={contactIdentifier} cta={getContactControlBar()} />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-4 gap-x-8">
          <AttributesSection contactId={params.contactId} workspaceId={workspace.id} />
          <ActivitySection
            workspaceId={workspace.id}
            contactId={params.contactId}
            environmentTags={environmentTags}
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};
