import { OrganizationSettingsNavbar } from "@/app/(app)/workspaces/[workspaceId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackRecordDirectoryView } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-view";
import { getIsFeedbackRecordDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const FeedbackRecordDirectoriesPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { currentUserMembership, organization } = await getWorkspaceAuth(params.workspaceId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);

  const isFeedbackRecordDirectoriesAllowed = await getIsFeedbackRecordDirectoriesEnabled(organization.id);
  if (!isFeedbackRecordDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.settings.general.organization_settings")}>
          <OrganizationSettingsNavbar
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            membershipRole={currentUserMembership.role}
            activeId="feedback-record-directories"
          />
        </PageHeader>
        <UpgradePrompt
          title={t("workspace.settings.feedback_record_directories.upgrade_prompt_title")}
          description={t("workspace.settings.feedback_record_directories.upgrade_prompt_description")}
          feature="feedback-record-directories"
          buttons={[
            {
              text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
              href: IS_FORMBRICKS_CLOUD
                ? `/workspaces/${params.workspaceId}/settings/billing`
                : "https://formbricks.com/upgrade-self-hosting-license",
            },
            {
              text: t("common.learn_more"),
              href: IS_FORMBRICKS_CLOUD
                ? `/workspaces/${params.workspaceId}/settings/billing`
                : "https://formbricks.com/learn-more-self-hosting-license",
            },
          ]}
        />
      </PageContentWrapper>
    );
  }

  if (!isOwner && !isManager) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.settings.general.organization_settings")}>
          <OrganizationSettingsNavbar
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            membershipRole={currentUserMembership.role}
            activeId="feedback-record-directories"
          />
        </PageHeader>
        <p className="text-sm text-slate-500">
          {t("workspace.settings.feedback_record_directories.no_access")}
        </p>
      </PageContentWrapper>
    );
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership.role}
          activeId="feedback-record-directories"
        />
      </PageHeader>
      <FeedbackRecordDirectoryView
        organizationId={organization.id}
        membershipRole={currentUserMembership.role}
      />
    </PageContentWrapper>
  );
};
