import { notFound } from "next/navigation";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsUnifyFeedbackEnabled } from "@/modules/ee/license-check/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { ConnectorsSection } from "./components/connectors-page-client";
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
  if (!hasAccess) {
    return notFound();
  }

  const isUnifyFeedbackAllowed = await getIsUnifyFeedbackEnabled(organization.id);
  if (!isUnifyFeedbackAllowed) {
    return (
      <PageContentWrapper>
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
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
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

  const [connectors, surveys, directories] = await Promise.all([
    getConnectorsWithMappings(params.workspaceId),
    getSurveys(params.workspaceId),
    getFeedbackDirectoriesByWorkspaceId(params.workspaceId),
  ]);

  const unifySurveys = surveys.map(transformToUnifySurvey);

  return (
    <ConnectorsSection
      workspaceId={params.workspaceId}
      initialConnectors={connectors}
      initialSurveys={unifySurveys}
      directories={directories}
      isReadOnly={isReadOnly}
    />
  );
};
