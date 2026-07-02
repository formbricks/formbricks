import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { NoFeedbackDirectoryEmptyState } from "@/modules/ee/feedback-directory/components/no-feedback-directory-empty-state";
import { assertCanWriteDirectoryRecords } from "@/modules/ee/feedback-directory/lib/access";
import { getFeedbackDirectoriesForUser } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { UnifyFeedbackNavigation } from "@/modules/ee/unify-feedback/components/unify-feedback-navigation";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { TopicsSubtopicsPreview } from "./components/topics-subtopics-preview";

export const UnifyTopicsSubtopicsPage = async (
  props: Readonly<{ params: Promise<{ organizationId: string }> }>
) => {
  const t = await getTranslate();
  const params = await props.params;

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { session, currentUserMembership, organization } = await getOrganizationAuth(params.organizationId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);
  const isOwnerOrManager = isOwner || isManager;

  const pageTitle = t("workspace.unify.feedback_records");

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle}>
          <UnifyFeedbackNavigation organizationId={organization.id} />
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

  // Datasets the user may VIEW: owner/manager see all (getFeedbackDirectoriesForUser returns archived
  // ones for them too), members see only active datasets reachable through a workspace they belong to.
  // Archived datasets are dropped here regardless of role — generating a taxonomy against a dataset that
  // no longer ingests feedback isn't useful, so the topics view only offers active datasets.
  const datasets = (await getFeedbackDirectoriesForUser(session.user.id, organization.id)).filter(
    (dataset) => !dataset.isArchived
  );

  if (datasets.length === 0) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle}>
          <UnifyFeedbackNavigation organizationId={organization.id} />
        </PageHeader>
        <NoFeedbackDirectoryEmptyState organizationId={organization.id} isOwnerOrManager={isOwnerOrManager} />
      </PageContentWrapper>
    );
  }

  // Write access (taxonomy generation, node rename/remove) is per-dataset: a member can write to one
  // dataset but only read another. Resolve it once per viewable dataset here so the client can gate its
  // write controls on the selected dataset. The taxonomy actions re-check write access regardless, so
  // this map is a UX gate, not the security boundary.
  const canWriteEntries = await Promise.all(
    datasets.map(async (dataset): Promise<[string, boolean]> => {
      try {
        await assertCanWriteDirectoryRecords(session.user.id, organization.id, dataset.id);
        return [dataset.id, true];
      } catch {
        return [dataset.id, false];
      }
    })
  );
  const canWriteMap = Object.fromEntries(canWriteEntries);

  return (
    <TopicsSubtopicsPreview
      organizationId={organization.id}
      datasets={datasets.map((dataset) => ({ id: dataset.id, name: dataset.name }))}
      canWriteMap={canWriteMap}
    />
  );
};
