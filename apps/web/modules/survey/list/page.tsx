import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DEFAULT_LOCALE, IS_FORMBRICKS_CLOUD, SURVEYS_PER_PAGE } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { resolveDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSurveyAIAvailability } from "@/modules/survey/lib/get-survey-ai-availability";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { SurveysList } from "@/modules/survey/list/components/survey-list";
import { getSurveyVisibilityUiGate } from "@/modules/survey/visibility/lib/gate";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface SurveyTemplateProps {
  readonly params: Promise<{
    workspaceId: string;
  }>;
}

// Runs the page's own access check first: a workspace the page 404s on (missing or not this user's)
// then 404s here too, so the tab takes the not-found page's title rather than "Surveys".
export const generateMetadata = async ({ params }: SurveyTemplateProps): Promise<Metadata> => {
  await getWorkspaceAuth((await params).workspaceId);
  const t = await getTranslate();

  return { title: t("common.surveys") };
};

export const SurveysPage = async ({ params: paramsProps }: SurveyTemplateProps) => {
  const publicDomain = getPublicDomain();
  const params = await paramsProps;

  const workspace = await getWorkspaceWithTeamIds(params.workspaceId);

  if (!workspace) {
    return notFound();
  }

  const { session, isBilling, isReadOnly } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(workspace.organizationId, IS_FORMBRICKS_CLOUD));
  }

  const currentWorkspaceChannel = workspace.config.channel ?? null;
  const [locale, featuredTemplatesVariant, { isAIAvailable, aiUnavailableReason }, surveyVisibilityGate] =
    await Promise.all([
      getUserLocale(session.user.id).then((l) => l ?? DEFAULT_LOCALE),
      getPostHogFeatureFlag(session.user.id, "a-b_surveys_featured-templates-create-with-ai"),
      getSurveyAIAvailability(workspace.organizationId, { isReadOnly }),
      getSurveyVisibilityUiGate(workspace.organizationId),
    ]);
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
      surveysPerPage={SURVEYS_PER_PAGE}
      currentWorkspaceChannel={currentWorkspaceChannel}
      locale={locale}
      defaultSurveyLanguage={resolveDefaultSurveyLanguage({
        workspaceDefaultLanguage: workspace.config.defaultSurveyLanguage,
        userLocale: locale,
      })}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
      showFeaturedTemplates={featuredTemplatesVariant === "test"}
      surveyVisibilityGate={surveyVisibilityGate}
      currentUserId={session.user.id}
    />
  );
};
