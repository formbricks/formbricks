import { GoogleSheetWrapper } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/GoogleSheetWrapper";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { GoBackButton } from "@formbricks/ui/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }) => {
  const isEnabled = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET && GOOGLE_SHEETS_REDIRECT_URL);
  const [surveys, integrations, environment, attributeClasses] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const product = await getProductByEnvironmentId(params.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }

  const googleSheetIntegration: TIntegrationGoogleSheets | undefined = integrations?.find(
    (integration): integration is TIntegrationGoogleSheets => integration.type === "googleSheets"
  );

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle="Google Sheets Integration" />
      <div className="h-[75vh] w-full">
        <GoogleSheetWrapper
          isEnabled={isEnabled}
          environment={environment}
          surveys={surveys}
          googleSheetIntegration={googleSheetIntegration}
          webAppUrl={WEBAPP_URL}
          attributeClasses={attributeClasses}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
