import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { NoFeedbackDirectoryEmptyState } from "@/modules/ee/feedback-directory/components/no-feedback-directory-empty-state";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { UnifyConfigNavigation } from "@/modules/ee/unify-feedback/components/unify-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TopicsSubtopicsPreview } from "./components/topics-subtopics-preview";

export const UnifyTopicsSubtopicsPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) => {
  const t = await getTranslate();
  const params = await props.params;

  const { isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, session, organization } =
    await getWorkspaceAuth(params.workspaceId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_records")}>
          <UnifyConfigNavigation workspaceId={params.workspaceId} activeId="topics-subtopics" />
        </PageHeader>
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.unify.upgrade_prompt_title")}
            description={t("workspace.unify.upgrade_prompt_description")}
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

  const directories = await getFeedbackDirectoriesByWorkspaceId(params.workspaceId);

  if (directories.length === 0) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_records")}>
          <UnifyConfigNavigation workspaceId={params.workspaceId} activeId="topics-subtopics" />
        </PageHeader>
        <NoFeedbackDirectoryEmptyState
          workspaceId={params.workspaceId}
          isOwnerOrManager={isOwner || isManager}
        />
      </PageContentWrapper>
    );
  }

  const directoryMap = Object.fromEntries(directories.map((directory) => [directory.id, directory.name]));

  return <TopicsSubtopicsPreview workspaceId={params.workspaceId} directoryMap={directoryMap} />;
};
