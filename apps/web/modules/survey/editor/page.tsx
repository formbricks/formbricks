import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  DEFAULT_LOCALE,
  IS_FORMBRICKS_CLOUD,
  IS_STORAGE_CONFIGURED,
  MAIL_FROM,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import {
  getIsContactsEnabled,
  getIsQuotasEnabled,
  getIsSpamProtectionEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getTeamMemberDetails } from "@/modules/survey/editor/lib/team";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getWorkspaceLanguages } from "@/modules/survey/editor/lib/workspace";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { getWorkspaceWithTeamIdsByEnvironmentId } from "@/modules/survey/lib/workspace";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { SurveyEditor } from "./components/survey-editor";
import { getUserLocale } from "./lib/user";

export const generateMetadata = async (props: { params: Promise<{ surveyId: string }> }) => {
  const params = await props.params;
  const survey = await getSurvey(params.surveyId);
  return {
    title: survey?.name ? `${survey?.name} | Editor` : "Editor",
  };
};

export const SurveyEditorPage = async (props: {
  params: Promise<{ environmentId: string; surveyId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { session, isMember, environment, hasReadAccess, currentUserMembership, workspacePermission } =
    await getEnvironmentAuth(params.environmentId);

  const t = await getTranslate();
  const workspaceId = environment.workspaceId;

  const [survey, workspaceWithTeamIds, actionClasses, contactAttributeKeys, responseCount, segments] =
    await Promise.all([
      getSurvey(params.surveyId),
      getWorkspaceWithTeamIdsByEnvironmentId(params.environmentId),
      getActionClasses(workspaceId),
      getContactAttributeKeys(workspaceId),
      getResponseCountBySurveyId(params.surveyId),
      getSegments(workspaceId),
    ]);

  if (!workspaceWithTeamIds) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const organizationBilling = await getOrganizationBilling(workspaceWithTeamIds.organizationId);
  if (!organizationBilling) {
    throw new ResourceNotFoundError(t("common.organization"), workspaceWithTeamIds.organizationId);
  }

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;
  const [locale, userEmail] = await Promise.all([
    getUserLocale(session.user.id),
    getUserEmail(session.user.id),
  ]);

  const [
    isSurveyFollowUpsAllowed,
    isSpamProtectionAllowed,
    isQuotasAllowed,
    isExternalUrlsAllowed,
    isUserTargetingAllowed,
  ] = await Promise.all([
    getSurveyFollowUpsPermission(workspaceWithTeamIds.organizationId),
    getIsSpamProtectionEnabled(workspaceWithTeamIds.organizationId),
    getIsQuotasEnabled(workspaceWithTeamIds.organizationId),
    getExternalUrlsPermission(workspaceWithTeamIds.organizationId),
    getIsContactsEnabled(workspaceWithTeamIds.organizationId),
  ]);

  const quotas = isQuotasAllowed && survey ? await getQuotas(survey.id) : [];
  const [workspaceLanguages, teamMemberDetails] = await Promise.all([
    getWorkspaceLanguages(workspaceWithTeamIds.id),
    getTeamMemberDetails(workspaceWithTeamIds.teamIds),
  ]);

  if (
    !survey ||
    !environment ||
    !actionClasses ||
    !contactAttributeKeys ||
    !workspaceWithTeamIds ||
    !userEmail ||
    isSurveyCreationDeletionDisabled
  ) {
    return <ErrorComponent />;
  }

  const isCxMode = searchParams.mode === "cx";
  const publicDomain = getPublicDomain();

  return (
    <SurveyEditor
      survey={survey}
      workspace={workspaceWithTeamIds}
      environment={environment}
      actionClasses={actionClasses}
      contactAttributeKeys={contactAttributeKeys}
      responseCount={responseCount}
      membershipRole={currentUserMembership.role}
      workspacePermission={workspacePermission}
      colors={SURVEY_BG_COLORS}
      segments={segments}
      isUserTargetingAllowed={isUserTargetingAllowed}
      isSpamProtectionAllowed={isSpamProtectionAllowed}
      workspaceLanguages={workspaceLanguages}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
      isCxMode={isCxMode}
      locale={locale ?? DEFAULT_LOCALE}
      mailFrom={MAIL_FROM ?? "hola@formbricks.com"}
      isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
      userEmail={userEmail}
      teamMemberDetails={teamMemberDetails}
      isStorageConfigured={IS_STORAGE_CONFIGURED}
      isQuotasAllowed={isQuotasAllowed}
      quotas={quotas}
      isExternalUrlsAllowed={isExternalUrlsAllowed}
      publicDomain={publicDomain}
    />
  );
};
