import { getTranslate } from "@/lingodotdev/server";
import { AttributeKeysManager } from "@/modules/ee/contacts/attributes/components/attribute-keys-manager";
import { CreateAttributeKeyButton } from "@/modules/ee/contacts/attributes/components/create-attribute-key-button";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const AttributesPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const t = await getTranslate();

  const { isReadOnly } = await getEnvironmentAuth(params.environmentId);
  const attributeKeys = await getContactAttributeKeys(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("common.contacts")}
        cta={!isReadOnly ? <CreateAttributeKeyButton environmentId={params.environmentId} /> : undefined}>
        <ContactsSecondaryNavigation activeId="attributes" environmentId={params.environmentId} />
      </PageHeader>
      <AttributeKeysManager
        environmentId={params.environmentId}
        attributeKeys={attributeKeys}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};
