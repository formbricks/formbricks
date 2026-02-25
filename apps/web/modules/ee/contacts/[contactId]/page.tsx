import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { getTranslate } from "@/lingodotdev/server";
import { AttributesSection } from "@/modules/ee/contacts/[contactId]/components/attributes-section";
import { ContactControlBar } from "@/modules/ee/contacts/[contactId]/components/contact-control-bar";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContactAttributesWithKeyInfo } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { getPublishedLinkSurveys } from "@/modules/ee/contacts/lib/surveys";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ActivitySection } from "./components/activity-section";

export const SingleContactPage = async (props: {
  params: Promise<{ environmentId: string; contactId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  const { environment, isReadOnly, organization } = await getEnvironmentAuth(params.environmentId);

  const [environmentTags, contact, publishedLinkSurveys, attributesWithKeyInfo, allAttributeKeys] =
    await Promise.all([
      getTagsByEnvironmentId(params.environmentId),
      getContact(params.contactId),
      getPublishedLinkSurveys(params.environmentId),
      getContactAttributesWithKeyInfo(params.contactId),
      getContactAttributeKeys(params.environmentId),
    ]);

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

  const isQuotasAllowed = await getIsQuotasEnabled(organization.billing.plan);

  // Derive contact identifier from metadata array
  const getAttributeValue = (key: string): string | undefined => {
    return attributesWithKeyInfo.find((attr) => attr.key === key)?.value;
  };

  const contactIdentifier = getAttributeValue("email") || getAttributeValue("userId") || "";

  const getContactControlBar = () => {
    return (
      <ContactControlBar
        environmentId={environment.id}
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
      <GoBackButton url={`/environments/${params.environmentId}/contacts`} />
      <PageHeader pageTitle={contactIdentifier} cta={getContactControlBar()} />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-4 gap-x-8">
          <AttributesSection contactId={params.contactId} />
          <ActivitySection
            environment={environment}
            contactId={params.contactId}
            environmentTags={environmentTags}
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};
