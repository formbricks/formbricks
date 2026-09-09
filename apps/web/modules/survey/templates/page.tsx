import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSurveyAIAvailability } from "@/modules/survey/lib/get-survey-ai-availability";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TemplateContainerWithPreview } from "./components/template-container";

interface SurveyTemplateProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export const SurveyTemplatesPage = async (props: Readonly<SurveyTemplateProps>) => {
  const t = await getTranslate();
  const params = await props.params;
  const workspaceId = params.workspaceId;

  const { session, isReadOnly } = await getWorkspaceAuth(workspaceId);

  const workspace = await getWorkspaceWithTeamIds(workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  if (isReadOnly) {
    return redirect(`/workspaces/${workspace.id}/surveys`);
  }

  const publicDomain = getPublicDomain();
  // The import card on this page needs the same AI gate the survey list computes for its entry points.
  const [locale, { isAIAvailable, aiUnavailableReason }] = await Promise.all([
    getUserLocale(session.user.id).then((l) => l ?? DEFAULT_LOCALE),
    getSurveyAIAvailability(workspace.organizationId, { isReadOnly }),
  ]);

  return (
    <TemplateContainerWithPreview
      workspace={workspace}
      publicDomain={publicDomain}
      defaultLanguage={locale}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
};
