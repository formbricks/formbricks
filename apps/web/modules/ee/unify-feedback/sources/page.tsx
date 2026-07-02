import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getFeedbackSourcesByOrganizationId } from "@/lib/feedback-source/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import {
  getFeedbackDirectoriesForUser,
  getFeedbackDirectoryAuthContext,
} from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { FeedbackSourcesSection } from "./components/feedback-sources-page-client";

export const OrganizationFeedbackSourcesPage = async (
  props: Readonly<{ params: Promise<{ organizationId: string }> }>
) => {
  const t = await getTranslate();
  const params = await props.params;

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { session, currentUserMembership, organization } = await getOrganizationAuth(params.organizationId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);
  const isOwnerOrManager = isOwner || isManager;

  const pageTitle = t("workspace.unify.feedback_sources");

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
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

  // All sources across the org (owner/manager). Members only ever reach this page for datasets they can
  // view, so we filter the source list down to sources whose dataset is viewable by the user below.
  const [allFeedbackSources, viewableDatasets, accessibleWorkspaces] = await Promise.all([
    getFeedbackSourcesByOrganizationId(organization.id),
    // Datasets the user may VIEW; empty for a member with no reachable dataset (renders empty table).
    getFeedbackDirectoriesForUser(session.user.id, organization.id),
    // Role-scoped workspaces: owner/manager get all org workspaces, members only their team workspaces.
    getUserWorkspaces(session.user.id, organization.id),
  ]);

  const viewableDatasetIds = new Set(viewableDatasets.map((dataset) => dataset.id));
  const feedbackSources = allFeedbackSources.filter((source) =>
    viewableDatasetIds.has(source.feedbackDirectoryId)
  );

  // Workspaces the user may CREATE a source in: owner/manager may use any workspace they can reach;
  // members need readWrite/manage. Mirrors the create action's write rule so the modal's workspace
  // picker only offers workspaces where creation will actually succeed.
  const writableWorkspaceIds = new Set<string>();
  if (isOwnerOrManager) {
    accessibleWorkspaces.forEach((workspace) => writableWorkspaceIds.add(workspace.id));
  } else {
    const permissions = await Promise.all(
      accessibleWorkspaces.map(async (workspace) => ({
        workspaceId: workspace.id,
        permission: await getWorkspacePermissionByUserId(session.user.id, workspace.id),
      }))
    );
    permissions.forEach(({ workspaceId, permission }) => {
      if (permission === "readWrite" || permission === "manage") {
        writableWorkspaceIds.add(workspaceId);
      }
    });
  }

  // For each viewable dataset, resolve the workspaces it is assigned to that the user can also write to.
  // A source can only ever target a dataset assigned to its own workspace, so the create modal offers,
  // per dataset, exactly the intersection of (dataset assignments) and (the user's writable workspaces).
  const datasetContexts = await Promise.all(
    viewableDatasets.map((dataset) => getFeedbackDirectoryAuthContext(dataset.id))
  );
  const datasets = viewableDatasets.map((dataset, index) => {
    const assignedWorkspaceIds = datasetContexts[index]?.workspaceIds ?? [];
    // writableWorkspaceIds is already a subset of the user's accessible workspaces.
    const eligibleWorkspaceIds = assignedWorkspaceIds.filter((workspaceId) =>
      writableWorkspaceIds.has(workspaceId)
    );
    return { id: dataset.id, name: dataset.name, workspaceIds: eligibleWorkspaceIds };
  });

  const workspaces = accessibleWorkspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
  }));

  // Read-only when the user cannot create a source anywhere: no owner/manager role and no writable
  // workspace assigned to a viewable dataset. Server actions re-check per source regardless.
  const canCreateSource = datasets.some((dataset) => dataset.workspaceIds.length > 0);
  const isReadOnly = !canCreateSource;

  return (
    <FeedbackSourcesSection
      organizationId={organization.id}
      initialFeedbackSources={feedbackSources}
      datasets={datasets}
      workspaces={workspaces}
      isReadOnly={isReadOnly}
    />
  );
};
