import { ReactNode } from "react";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { ContactsSecondaryNavigation } from "./contacts-secondary-navigation";

interface ContactsPageLayoutProps {
  pageTitle: string;
  activeId: string;
  environmentId: string;
  isContactsEnabled: boolean;
  isReadOnly: boolean;
  cta?: ReactNode;
  children: ReactNode;
  upgradePromptTitle?: string;
  upgradePromptDescription?: string;
}

export const ContactsPageLayout = async ({
  pageTitle,
  activeId,
  environmentId,
  isContactsEnabled,
  isReadOnly,
  cta,
  children,
  upgradePromptTitle,
  upgradePromptDescription,
}: ContactsPageLayoutProps) => {
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} cta={isContactsEnabled && !isReadOnly ? cta : undefined}>
        <ContactsSecondaryNavigation activeId={activeId} environmentId={environmentId} />
      </PageHeader>

      {isContactsEnabled ? (
        children
      ) : (
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={upgradePromptTitle ?? t("environments.contacts.unlock_contacts_title")}
            description={upgradePromptDescription ?? t("environments.contacts.unlock_contacts_description")}
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.start_free_trial") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/environments/${environmentId}/settings/billing`
                  : "https://formbricks.com/upgrade-self-hosting-license",
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/environments/${environmentId}/settings/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
