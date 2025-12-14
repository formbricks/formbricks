import { getTranslate } from "@/lingodotdev/server";
import { AttributeKeysManager } from "@/modules/ee/contacts/attributes/attribute-keys-manager";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export default async function AttributeKeysPage({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) {
  const params = await paramsProps;
  const { environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);
  const t = await getTranslate();

  const attributeKeys = await getContactAttributeKeys(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.contacts")}>
        <ContactsSecondaryNavigation activeId="attributes" environmentId={params.environmentId} />
      </PageHeader>

      <AttributeKeysManager environmentId={environment.id} attributeKeys={attributeKeys} />
    </PageContentWrapper>
  );
}
