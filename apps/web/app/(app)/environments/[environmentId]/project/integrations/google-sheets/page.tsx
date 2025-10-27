import { redirect } from "next/navigation";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { GoogleSheetWrapper } from "@/app/(app)/environments/[environmentId]/project/integrations/google-sheets/components/GoogleSheetWrapper";
import { getSurveys } from "@/app/(app)/environments/[environmentId]/project/integrations/lib/surveys";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@/lib/constants";
import { getIntegrations } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const isEnabled = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET && GOOGLE_SHEETS_REDIRECT_URL);

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [surveys, integrations] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
  ]);

  const googleSheetIntegration: TIntegrationGoogleSheets | undefined = integrations?.find(
    (integration): integration is TIntegrationGoogleSheets => integration.type === "googleSheets"
  );

  const locale = await findMatchingLocale();

  if (isReadOnly) {
    return redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/project/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.google_sheets.google_sheets_integration")} />
      <div className="h-[75vh] w-full">
        <GoogleSheetWrapper
          isEnabled={isEnabled}
          environment={environment}
          surveys={surveys}
          googleSheetIntegration={googleSheetIntegration}
          webAppUrl={WEBAPP_URL}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
