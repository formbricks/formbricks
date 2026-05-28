import { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { DEFAULT_LOCALE, IS_FORMBRICKS_CLOUD, SURVEYS_PER_PAGE } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { SurveysList } from "@/modules/survey/list/components/survey-list";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const SurveysPage = async ({ params: paramsProps }: SurveyTemplateProps) => {
  const publicDomain = getPublicDomain();
  const params = await paramsProps;
  const t = await getTranslate();

  const workspace = await getWorkspaceWithTeamIds(params.workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const { session, isBilling, isReadOnly } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(params.workspaceId, IS_FORMBRICKS_CLOUD));
  }

  const currentWorkspaceChannel = workspace.config.channel ?? null;
  const locale = (await getUserLocale(session.user.id)) ?? DEFAULT_LOCALE;
  const aiConfig = isReadOnly ? null : await getOrganizationAIConfig(workspace.organizationId);
  const aiUnavailableReason = aiConfig ? getAISmartToolsUnavailableReason(aiConfig) : undefined;
  const workspaceWithRequiredProps = {
    ...workspace,
    brandColor: workspace.styling?.brandColor?.light ?? null,
    highlightBorderColor: null,
  };

  return (
    <SurveysList
      workspace={workspaceWithRequiredProps}
      isReadOnly={isReadOnly}
      publicDomain={publicDomain}
      userId={session.user.id}
      surveysPerPage={SURVEYS_PER_PAGE}
      currentWorkspaceChannel={currentWorkspaceChannel}
      locale={locale}
      isAIAvailable={!aiUnavailableReason}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
};
