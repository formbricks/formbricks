import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackDirectoryView } from "@/modules/ee/feedback-directory/components/feedback-directory-view";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

export const FeedbackDirectoriesPage = async (props: { params: Promise<{ organizationId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { currentUserMembership, organization, session } = await getOrganizationAuth(params.organizationId);

  // ENG-2409: was a second `getAccessFlags(currentUserMembership.role)` on a role this page had
  // already been handed, then `!isOwner && !isManager`. `organization.manage` is the same set.
  // `membershipRole` below still comes from the row — that is a rendering prop, retained by design.
  //
  // Run alongside the license lookup rather than before it: the two are independent (one asks about
  // the caller's role, the other about the organization's plan), and the flag test this replaced was
  // synchronous, so awaiting them in series would have made every load of this page pay for both
  // round trips end to end. The *branches* below keep their original order — an unlicensed
  // organization must still see the upgrade prompt rather than a no-access message.
  const [canManageOrganization, isFeedbackDirectoriesAllowed] = await Promise.all([
    withAuthorizationSurface("page", () =>
      can({ type: "user", id: session.user.id }, "organization.manage", {
        type: "organization",
        id: organization.id,
      })
    ),
    getIsFeedbackDirectoriesEnabled(organization.id),
  ]);

  const pageTitle = t("workspace.settings.feedback_directories.title");

  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
        <SettingsCard
          title={t("workspace.settings.feedback_directories.title")}
          description={t("workspace.settings.feedback_directories.description")}>
          <UpgradePrompt
            title={t("workspace.settings.feedback_directories.upgrade_prompt_title")}
            description={t("workspace.settings.feedback_directories.upgrade_prompt_description")}
            feature="feedback-directories"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? getOrganizationBillingPath(params.organizationId, IS_FORMBRICKS_CLOUD)
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? getOrganizationBillingPath(params.organizationId, IS_FORMBRICKS_CLOUD)
                  : "https://formbricks.com/learn-more-self-hosting-license?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=ee_lock_feedback_directory",
              },
            ]}
          />
        </SettingsCard>
      </PageContentWrapper>
    );
  }

  if (!canManageOrganization) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
        <p className="text-sm text-slate-500">{t("workspace.settings.feedback_directories.no_access")}</p>
      </PageContentWrapper>
    );
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} />
      <FeedbackDirectoryView organizationId={organization.id} membershipRole={currentUserMembership.role} />
    </PageContentWrapper>
  );
};
