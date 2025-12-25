import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { AttributesTable } from "./components/attributes-table";
import { CreateAttributeModal } from "./components/create-attribute-modal";

export const AttributesPage = async ({
    params: paramsProps,
}: {
    params: Promise<{ environmentId: string }>;
}) => {
    const params = await paramsProps;
    const t = await getTranslate();

    const [{ isReadOnly }, contactAttributeKeys] = await Promise.all([
        getEnvironmentAuth(params.environmentId),
        getContactAttributeKeys(params.environmentId),
    ]);

    const isContactsEnabled = await getIsContactsEnabled();

    return (
        <PageContentWrapper>
            <PageHeader
                pageTitle="Contacts"
                cta={
                    isContactsEnabled && !isReadOnly ? (
                        <CreateAttributeModal environmentId={params.environmentId} />
                    ) : undefined
                }>
                <ContactsSecondaryNavigation activeId="attributes" environmentId={params.environmentId} />
            </PageHeader>

            {isContactsEnabled ? (
                <AttributesTable
                    contactAttributeKeys={contactAttributeKeys}
                    isReadOnly={isReadOnly}
                    environmentId={params.environmentId}
                />
            ) : (
                <div className="flex items-center justify-center">
                    <UpgradePrompt
                        title={t("environments.contacts.unlock_contacts_title")}
                        description={t("environments.contacts.unlock_contacts_description")}
                        buttons={[
                            {
                                text: IS_FORMBRICKS_CLOUD ? t("common.start_free_trial") : t("common.request_trial_license"),
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

