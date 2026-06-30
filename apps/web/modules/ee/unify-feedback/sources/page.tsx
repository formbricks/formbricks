import { notFound } from "next/navigation";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackSourcesSection } from "./components/feedback-sources-page-client";
import { transformToUnifySurvey } from "./lib";

export const WorkspaceFeedbackSourcesPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) => {
  const t = await getTranslate();
  const params = await props.params;

  const {
    isOwner,
    isManager,
    hasReadAccess,
    hasReadWriteAccess,
    hasManageAccess,
    isReadOnly,
    session,
    organization,
  } = await getWorkspaceAuth(params.workspaceId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  const pageTitle = t("workspace.unify.feedback_sources");
  if (!hasAccess) {
    return notFound();
  }

  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organization.id);
  if (!isFeedbackDirectoriesAllowed) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={pageTitle} />
        <SettingsCard
          title={t("workspace.unify.feedback_sources")}
          description={t("workspace.unify.feedback_sources_settings_description")}>
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
                href: IS_FORMBRICKS_CLOUD
                  ? `/organizations/${organization.id}/settings/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </SettingsCard>
      </PageContentWrapper>
    );
  }

  const [feedbackSources, surveys, directories] = await Promise.all([
    getFeedbackSourcesWithMappings(params.workspaceId),
    getSurveys(params.workspaceId),
    getFeedbackDirectoriesByWorkspaceId(params.workspaceId),
  ]);

  const unifySurveys = surveys.map(transformToUnifySurvey);

  return (
    <FeedbackSourcesSection
      workspaceId={params.workspaceId}
      initialFeedbackSources={feedbackSources}
      initialSurveys={unifySurveys}
      directories={directories}
      isReadOnly={isReadOnly}
    />
  );
};
