import { GoogleSheetWrapper } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/GoogleSheetWrapper";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const t = await getTranslations();
  const isEnabled = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET && GOOGLE_SHEETS_REDIRECT_URL);
  const [session, surveys, integrations, environment, attributeClasses] = await Promise.all([
    getServerSession(authOptions),
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  const product = await getProductByEnvironmentId(params.environmentId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const googleSheetIntegration: TIntegrationGoogleSheets | undefined = integrations?.find(
    (integration): integration is TIntegrationGoogleSheets => integration.type === "googleSheets"
  );

  const locale = findMatchingLocale();

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    product.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.organizationRole);

  const productPermission = await getProductPermissionByUserId(session?.user.id, environment?.productId);

  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  if (isReadOnly) {
    redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.google_sheets.google_sheets_integration")} />
      <div className="h-[75vh] w-full">
        <GoogleSheetWrapper
          isEnabled={isEnabled}
          environment={environment}
          surveys={surveys}
          googleSheetIntegration={googleSheetIntegration}
          webAppUrl={WEBAPP_URL}
          attributeClasses={attributeClasses}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
