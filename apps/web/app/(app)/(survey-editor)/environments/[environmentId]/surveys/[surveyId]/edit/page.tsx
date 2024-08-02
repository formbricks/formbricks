import { getServerSession } from "next-auth";
import { getAdvancedTargetingPermission, getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSegments } from "@formbricks/lib/segment/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { SurveyEditor } from "./components/SurveyEditor";

export const generateMetadata = async ({ params }) => {
  const survey = await getSurvey(params.surveyId);
  return {
    title: survey?.name ? `${survey?.name} | Editor` : "Editor",
  };
};

const Page = async ({ params }) => {
  const [
    survey,
    product,
    environment,
    actionClasses,
    attributeClasses,
    responseCount,
    organization,
    session,
    segments,
  ] = await Promise.all([
    getSurvey(params.surveyId),
    getProductByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getAttributeClasses(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getSegments(params.environmentId),
  ]);
  if (!session) {
    throw new Error("Session not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);
  const isSurveyCreationDeletionDisabled = isViewer;

  const isUserTargetingAllowed = await getAdvancedTargetingPermission(organization);
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  if (
    !survey ||
    !environment ||
    !actionClasses ||
    !attributeClasses ||
    !product ||
    isSurveyCreationDeletionDisabled
  ) {
    return <ErrorComponent />;
  }

  return (
    <SurveyEditor
      survey={survey}
      product={product}
      environment={environment}
      actionClasses={actionClasses}
      attributeClasses={attributeClasses}
      responseCount={responseCount}
      membershipRole={currentUserMembership?.role}
      organizationId={organization.id}
      colors={SURVEY_BG_COLORS}
      segments={segments}
      isUserTargetingAllowed={isUserTargetingAllowed}
      isMultiLanguageAllowed={isMultiLanguageAllowed}
      plan={organization.billing.plan}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUnsplashConfigured={UNSPLASH_ACCESS_KEY ? true : false}
    />
  );
};

export default Page;
