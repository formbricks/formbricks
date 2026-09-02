import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { resolveDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
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
  const locale = (await getUserLocale(session.user.id)) ?? DEFAULT_LOCALE;
  const defaultLanguage = resolveDefaultSurveyLanguage({
    workspaceDefaultLanguage: workspace.config.defaultSurveyLanguage,
    userLocale: locale,
  });

  return (
    <TemplateContainerWithPreview
      workspace={workspace}
      publicDomain={publicDomain}
      defaultLanguage={defaultLanguage}
      language={locale}
    />
  );
};
