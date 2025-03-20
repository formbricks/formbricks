import { AttributesSection } from "@/modules/ee/contacts/[contactId]/components/attributes-section";
import { DeleteContactButton } from "@/modules/ee/contacts/[contactId]/components/delete-contact-button";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { getContactIdentifier } from "@/modules/ee/contacts/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { ResponseSection } from "./components/response-section";

export const SingleContactPage = async (props: {
  params: Promise<{ environmentId: string; contactId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  const { environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const [environmentTags, contact, contactAttributes] = await Promise.all([
    getTagsByEnvironmentId(params.environmentId),
    getContact(params.contactId),
    getContactAttributes(params.contactId),
  ]);

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

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
          />
        </div>
      </section>
    </PageContentWrapper>
  );
};
