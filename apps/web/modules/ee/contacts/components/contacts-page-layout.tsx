import { ReactNode } from "react";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { ContactDirectoryEmptyState } from "./contact-directory-empty-state";
import { ContactDirectoryIndicator } from "./contact-directory-indicator";
import { ContactsSecondaryNavigation } from "./contacts-secondary-navigation";

interface ContactsPageLayoutProps {
  readonly pageTitle: string;
  readonly activeId: string;
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly isContactsEnabled: boolean;
  readonly isReadOnly: boolean;
  /** False when the workspace has no contact directory: the page shows the no-directory state instead. */
  readonly hasContactDirectory: boolean;
  readonly isOwnerOrManager: boolean;
  readonly cta?: ReactNode;
  /** The workspace's directory when other workspaces share it, shown next to the CTA, read-only users included. */
  readonly sharedDirectoryName?: string | null;
  readonly children: ReactNode;
  readonly upgradePromptTitle?: string;
  readonly upgradePromptDescription?: string;
  readonly upgradeFeature?: string;
}

export const ContactsPageLayout = async ({
  pageTitle,
  activeId,
  workspaceId,
  organizationId,
  isContactsEnabled,
  isReadOnly,
  hasContactDirectory,
  isOwnerOrManager,
  cta,
  sharedDirectoryName,
  children,
  upgradePromptTitle,
  upgradePromptDescription,
  upgradeFeature = "contacts",
}: ContactsPageLayoutProps) => {
  const t = await getTranslate();
  const organizationBillingPath = `/organizations/${organizationId}/settings/billing`;
  const visibleCta = isContactsEnabled && !isReadOnly ? cta : undefined;
  const directoryIndicator =
    isContactsEnabled && hasContactDirectory && sharedDirectoryName ? (
      <ContactDirectoryIndicator
        label={t("workspace.contacts.directory_line", { directoryName: sharedDirectoryName })}
        href={isOwnerOrManager ? `/organizations/${organizationId}/settings/contact-directories` : undefined}
      />
    ) : null;

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={pageTitle}
        cta={
          directoryIndicator ? (
            <div className="flex items-center gap-2">
              {directoryIndicator}
              {visibleCta}
            </div>
          ) : (
            visibleCta
          )
        }>
        <ContactsSecondaryNavigation activeId={activeId} workspaceId={workspaceId} />
      </PageHeader>

      {isContactsEnabled && !hasContactDirectory && (
        <ContactDirectoryEmptyState organizationId={organizationId} isOwnerOrManager={isOwnerOrManager} />
      )}
      {isContactsEnabled && hasContactDirectory && children}
      {!isContactsEnabled && (
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={upgradePromptTitle ?? t("workspace.contacts.unlock_contacts_title")}
            description={upgradePromptDescription ?? t("workspace.contacts.unlock_contacts_description")}
            feature={upgradeFeature}
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD ? organizationBillingPath : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? organizationBillingPath
                  : "https://formbricks.com/learn-more-self-hosting-license?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=ee_lock_contacts",
              },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
