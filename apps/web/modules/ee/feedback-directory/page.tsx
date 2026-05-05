import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackDirectoryView } from "@/modules/ee/feedback-directory/components/feedback-directory-view";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const FeedbackDirectoriesPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { currentUserMembership, organization } = await getWorkspaceAuth(params.workspaceId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.settings.feedback_directories.upgrade_prompt_title")}
            description={t("workspace.settings.feedback_directories.upgrade_prompt_description")}
            feature="feedback-directories"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/workspaces/${params.workspaceId}/settings/organization/billing`
                  : "https://formbricks.com/upgrade-self-hosting-license",
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/workspaces/${params.workspaceId}/settings/organization/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </div>
      </PageContentWrapper>
    );
  }

  if (!isOwner && !isManager) {
    return (
      <PageContentWrapper>
        <p className="text-sm text-slate-500">{t("workspace.settings.feedback_directories.no_access")}</p>
      </PageContentWrapper>
    );
  }

  return (
    <PageContentWrapper>
      <FeedbackDirectoryView organizationId={organization.id} membershipRole={currentUserMembership.role} />
    </PageContentWrapper>
  );
};
