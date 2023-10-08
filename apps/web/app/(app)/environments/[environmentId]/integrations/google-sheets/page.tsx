import GoogleSheetWrapper from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/GoogleSheetWrapper";
import GoBackButton from "@/components/shared/GoBackButton";
import { getSpreadSheets } from "@formbricks/lib/googleSheet/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TGoogleSheetIntegration, TGoogleSpreadsheet } from "@formbricks/types/v1/integrations";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  WEBAPP_URL,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";

export default async function GoogleSheet({ params }) {
  const enabled = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET && GOOGLE_SHEETS_REDIRECT_URL);
  const [surveys, integrations, environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const googleSheetIntegration: TGoogleSheetIntegration | undefined = integrations?.find(
    (integration): integration is TGoogleSheetIntegration => integration.type === "googleSheets"
  );
  let spreadSheetArray: TGoogleSpreadsheet[] = [];
  if (googleSheetIntegration && googleSheetIntegration.config.key) {
    spreadSheetArray = await getSpreadSheets(params.environmentId);
  }
  return (
    <>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <div className="h-[75vh] w-full">
        <GoogleSheetWrapper
          enabled={enabled}
          environment={environment}
          surveys={surveys}
          spreadSheetArray={spreadSheetArray}
          googleSheetIntegration={googleSheetIntegration}
          webAppUrl={WEBAPP_URL}
        />
      </div>
    </>
  );
}
