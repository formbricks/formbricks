import { notFound } from "next/navigation";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { FeedbackDataEmptyState } from "@/modules/ee/unify-feedback/components/feedback-data-empty-state";
import { UnifyConfigNavigation } from "@/modules/ee/unify-feedback/components/unify-config-navigation";
import { getAuthorizedWorkspaceFeedbackDirectories } from "@/modules/ee/unify-feedback/lib/access";
import { getConnectedSurveyIds, getRecordSourceNames } from "@/modules/ee/unify-feedback/lib/source-names";
import { getWorkspaceSurveyNames } from "@/modules/ee/unify-feedback/lib/survey-names";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackRecordsPageClient } from "./components/feedback-records-page-client";

export default async function UnifyFeedbackRecordsPage(
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) {
  const t = await getTranslate();
  const params = await props.params;

  const { isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, session, organization } =
    await getWorkspaceAuth(params.workspaceId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  const canWrite = isOwner || isManager || hasReadWriteAccess || hasManageAccess;
  // Records live in a directory shared across workspaces and carry no workspace of their own, so
  // deleting one is an org-level act — owners and managers only (ENG-1770). Importing is still
  // workspace work: it only adds records through this workspace's own feedback sources.
  const canDeleteRecords = isOwner || isManager;
  if (!hasAccess) {
    return notFound();
  }

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_data")}>
          <UnifyConfigNavigation workspaceId={params.workspaceId} activeId="feedback-records" />
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
                  ? `/organizations/${organization.id}/settings/billing`
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: "https://formbricks.com/docs/unify-feedback/overview",
              },
            ]}
          />
        </div>
      </PageContentWrapper>
    );
  }

  const [frds, feedbackSources] = await Promise.all([
    getAuthorizedWorkspaceFeedbackDirectories(session.user.id, params.workspaceId),
    getFeedbackSourcesWithMappings(params.workspaceId),
  ]);

  if (frds.length === 0) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_data")}>
          <UnifyConfigNavigation workspaceId={params.workspaceId} activeId="feedback-records" />
        </PageHeader>
        <FeedbackDataEmptyState
          variant="no-directory"
          organizationId={organization.id}
          isOwnerOrManager={isOwner || isManager}
        />
      </PageContentWrapper>
    );
  }

  const frdMap = Object.fromEntries(frds.map((f) => [f.id, f.name]));
  const csvSources = feedbackSources
    .filter((feedbackSource) => feedbackSource.type === "csv")
    .map((feedbackSource) => ({
      id: feedbackSource.id,
      name: feedbackSource.name,
      fieldMappings: feedbackSource.fieldMappings,
    }));

  // Records are read by the table itself, through the v3 list with the filters in the page URL. The
  // Source filter offers the `source_name` values records carry — a survey connector's survey names.
  const surveyNamesById = await getWorkspaceSurveyNames(
    params.workspaceId,
    getConnectedSurveyIds(feedbackSources)
  );
  const sourceNames = getRecordSourceNames(feedbackSources, surveyNamesById);

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      frdMap={frdMap}
      csvSources={csvSources}
      sourceNames={sourceNames}
      canWrite={canWrite}
      canDeleteRecords={canDeleteRecords}
    />
  );
}
