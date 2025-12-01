import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { getTranslate } from "@/lingodotdev/server";
import { AttributesSection } from "@/modules/ee/contacts/[contactId]/components/attributes-section";
import { ContactControlBar } from "@/modules/ee/contacts/[contactId]/components/contact-control-bar";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { getPublishedLinkSurveys } from "@/modules/ee/contacts/lib/surveys";
import { getContactIdentifier } from "@/modules/ee/contacts/lib/utils";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ResponseSection } from "./components/response-section";

export const SingleContactPage = async (props: {
  params: Promise<{ environmentId: string; contactId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  const { environment, isReadOnly, organization } = await getEnvironmentAuth(params.environmentId);

  const [environmentTags, contact, contactAttributes, publishedLinkSurveys] = await Promise.all([
    getTagsByEnvironmentId(params.environmentId),
    getContact(params.contactId),
    getContactAttributes(params.contactId),
    getPublishedLinkSurveys(params.environmentId),
  ]);

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

  const isQuotasAllowed = await getIsQuotasEnabled(organization.billing.plan);

  const getContactControlBar = () => {
    return (
      <ContactControlBar
        environmentId={environment.id}
        contactId={params.contactId}
        isReadOnly={isReadOnly}
        isQuotasAllowed={isQuotasAllowed}
        publishedLinkSurveys={publishedLinkSurveys}
      />
    );
  };

  return (
    <PageContentWrapper>
      <GoBackButton url={`/environments/${params.environmentId}/contacts`} />
      <PageHeader pageTitle={getContactIdentifier(contactAttributes)} cta={getContactControlBar()} />
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-4 gap-x-8">
          <AttributesSection contactId={params.contactId} />
          <ResponseSection
            environment={environment}
            contactId={params.contactId}
            environmentTags={environmentTags}
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};
