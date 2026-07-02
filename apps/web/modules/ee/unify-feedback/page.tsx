import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { NoFeedbackDirectoryEmptyState } from "@/modules/ee/feedback-directory/components/no-feedback-directory-empty-state";
import { getFeedbackDirectoriesForUser } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { FeedbackRecordsPageClient } from "./components/feedback-records-page-client";
import { getFeedbackDatasetView } from "./lib/dataset-view";

export const UnifyFeedbackRecordsPage = async (props: { params: Promise<{ organizationId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { session, currentUserMembership, organization } = await getOrganizationAuth(params.organizationId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);
  const isOwnerOrManager = isOwner || isManager;

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_records")} />
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.unify.upgrade_prompt_title")}
            description={t("workspace.unify.upgrade_prompt_description")}
            feature="feedback-directories"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? getOrganizationBillingPath(organization.id, IS_FORMBRICKS_CLOUD)
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

  // Datasets the user may VIEW: owner/manager see all; members see only datasets reachable through a
  // workspace they belong to. An empty list means the page shows the no-dataset state — a non-owner
  // member with zero reachable datasets simply sees the member-facing empty state (no leak).
  const datasets = await getFeedbackDirectoriesForUser(session.user.id, organization.id);
  if (datasets.length === 0) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.unify.feedback_records")} />
        <NoFeedbackDirectoryEmptyState organizationId={organization.id} isOwnerOrManager={isOwnerOrManager} />
      </PageContentWrapper>
    );
  }

  // SSR the default (first) dataset's full view; further datasets load client-side on selection.
  const defaultDatasetId = datasets[0].id;
  const initialView = await getFeedbackDatasetView(session.user.id, organization.id, defaultDatasetId);

  return (
    <FeedbackRecordsPageClient
      organizationId={organization.id}
      datasets={datasets.map((dataset) => ({ id: dataset.id, name: dataset.name }))}
      initialDatasetId={defaultDatasetId}
      initialView={initialView}
      isOwnerOrManager={isOwnerOrManager}
    />
  );
};
