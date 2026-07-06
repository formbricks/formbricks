import { notFound } from "next/navigation";
import { logger } from "@formbricks/logger";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { getTranslate } from "@/lingodotdev/server";
import { NoFeedbackDirectoryEmptyState } from "@/modules/ee/feedback-directory/components/no-feedback-directory-empty-state";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { UnifyConfigNavigation } from "@/modules/ee/unify-feedback/components/unify-config-navigation";
import { getContactIdsByUserIds } from "@/modules/ee/unify-feedback/lib/contacts";
import { listFeedbackRecords } from "@/modules/hub/service";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackRecordsPageClient } from "./components/feedback-records-page-client";

const INITIAL_PAGE_SIZE = 50;

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
    getFeedbackDirectoriesByWorkspaceId(params.workspaceId),
    getFeedbackSourcesWithMappings(params.workspaceId),
  ]);

  if (frds.length === 0) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_data")}>
          <UnifyConfigNavigation workspaceId={params.workspaceId} activeId="feedback-records" />
        </PageHeader>
        <NoFeedbackDirectoryEmptyState
          organizationId={organization.id}
          isOwnerOrManager={isOwner || isManager}
        />
      </PageContentWrapper>
    );
  }

  const results = await Promise.all(
    frds.map((frd) => listFeedbackRecords({ tenant_id: frd.id, limit: INITIAL_PAGE_SIZE }))
  );

  // Don't crash if Hub is unreachable — show empty state
  const successfulResults = results.filter((r) => !r.error);

  const merged = successfulResults
    .flatMap((r) => r.data?.data ?? [])
    .toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1));

  // Build per-FRD cursor map so the client can paginate
  const initialCursors: Record<string, string> = {};
  for (let i = 0; i < frds.length; i++) {
    const cursor = results[i]?.data?.next_cursor;
    if (cursor) {
      initialCursors[frds[i].id] = cursor;
    }
  }

  const frdMap = Object.fromEntries(frds.map((f) => [f.id, f.name]));
  const csvSources = feedbackSources
    .filter((feedbackSource) => feedbackSource.type === "csv")
    .map((feedbackSource) => ({
      id: feedbackSource.id,
      name: feedbackSource.name,
      fieldMappings: feedbackSource.fieldMappings,
    }));

  // Resolve the initial page's user_ids to contact ids in one batched query so records can
  // deep-link to the matching contact (in this workspace) without a per-record lookup. Contact
  // links are a non-critical enhancement, so a transient DB failure falls back to no links
  // rather than taking down the whole Feedback Data page.
  let initialContactIdByUserId: Record<string, string> = {};
  try {
    initialContactIdByUserId = await getContactIdsByUserIds(
      params.workspaceId,
      merged.map((record) => record.user_id).filter((id): id is string => Boolean(id))
    );
  } catch (error) {
    logger.error({ error, workspaceId: params.workspaceId }, "Failed to resolve feedback record contacts");
  }

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      initialRecords={merged}
      initialCursors={initialCursors}
      initialContactIdByUserId={initialContactIdByUserId}
      frdMap={frdMap}
      csvSources={csvSources}
      canWrite={canWrite}
    />
  );
}
