import { notFound } from "next/navigation";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsUnifyFeedbackEnabled } from "@/modules/ee/license-check/lib/utils";
import { listFeedbackRecords } from "@/modules/hub/service";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackRecordsPageClient } from "./components/feedback-records-page-client";
import { UnifyConfigNavigation } from "./components/unify-config-navigation";

const INITIAL_PAGE_SIZE = 50;

export const UnifyFeedbackRecordsPage = async (
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
  const canWrite = isOwner || isManager || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const isUnifyFeedbackAllowed = await getIsUnifyFeedbackEnabled(organization.id);
  if (!isUnifyFeedbackAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_records")}>
          <UnifyConfigNavigation workspaceId={params.workspaceId} activeId="feedback-records" />
        </PageHeader>
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.unify.upgrade_prompt_title")}
            description={t("workspace.unify.upgrade_prompt_description")}
            feature="unify-feedback"
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

  const [frds, connectors] = await Promise.all([
    getFeedbackDirectoriesByWorkspaceId(params.workspaceId),
    getConnectorsWithMappings(params.workspaceId),
  ]);

  const results = await Promise.all(
    frds.map((frd) => listFeedbackRecords({ tenant_id: frd.id, limit: INITIAL_PAGE_SIZE }))
  );

  // Don't crash if Hub is unreachable — show empty state
  const successfulResults = results.filter((r) => !r.error);

  const merged = successfulResults
    .flatMap((r) => r.data?.data ?? [])
    .toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1))
    .slice(0, INITIAL_PAGE_SIZE);

  const frdMap = Object.fromEntries(frds.map((f) => [f.id, f.name]));
  const csvSources = connectors
    .filter((connector) => connector.type === "csv")
    .map((connector) => ({ id: connector.id, name: connector.name }));

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      initialRecords={merged}
      frdMap={frdMap}
      csvSources={csvSources}
      canWrite={canWrite}
    />
  );
};
