import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  DEFAULT_LOCALE,
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
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
import { getTeamMemberDetails } from "@/modules/survey/editor/lib/team";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getWorkspaceLanguages } from "@/modules/survey/editor/lib/workspace";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import {
  getFinishedResponseCountBySurveyId,
  getResponseCountBySurveyId,
} from "@/modules/survey/lib/response";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { canReadSurveyInWorkspace, getSurveyAuth } from "@/modules/survey/lib/survey-auth";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { SURVEY_SCHEDULING_CONFIG } from "@/modules/survey/scheduling/lib/constants";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { SurveyEditor } from "./components/survey-editor";
import { getUserLocale } from "./lib/user";

export const generateMetadata = async (props: {
  params: Promise<{ workspaceId: string; surveyId: string }>;
}) => {
  const params = await props.params;

  // The survey name belongs to whoever owns the survey, so it may only be used as the title
  // when the caller may actually read this survey through this workspace. The page 404s
  // otherwise, but metadata resolves independently of it.
  if (!(await canReadSurveyInWorkspace(params.surveyId, params.workspaceId))) {
    return { title: "Editor" };
  }

  const survey = await getSurvey(params.surveyId);
  return {
    title: survey?.name ? `${survey?.name} | Editor` : "Editor",
  };
};

export const SurveyEditorPage = async (props: {
  params: Promise<{ workspaceId: string; surveyId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { session, isMember, hasReadAccess, currentUserMembership, workspacePermission, workspace } =
    await getSurveyAuth(params.workspaceId, params.surveyId);

  const t = await getTranslate();

  const [
    survey,
    workspaceWithTeamIds,
    actionClasses,
    contactAttributeKeys,
    responseCount,
    finishedResponseCount,
    segments,
  ] = await Promise.all([
    getSurvey(params.surveyId),
    getWorkspaceWithTeamIds(params.workspaceId),
    getActionClasses(workspace.id),
    getContactAttributeKeys(workspace.id),
    getResponseCountBySurveyId(params.surveyId),
    getFinishedResponseCountBySurveyId(params.surveyId),
    getSegments(workspace.id),
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
      actionClasses={actionClasses}
      contactAttributeKeys={contactAttributeKeys}
      responseCount={responseCount}
      finishedResponseCount={finishedResponseCount}
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
      surveySchedulingConfig={SURVEY_SCHEDULING_CONFIG}
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
      enterpriseLicenseRequestFormUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
    />
  );
};
