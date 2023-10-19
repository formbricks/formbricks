import GoogleSheetWrapper from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/GoogleSheetWrapper";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getSpreadSheets } from "@formbricks/lib/googleSheet/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TIntegrationItem } from "@formbricks/types/v1/integration";
import { TIntegrationGoogleSheets } from "@formbricks/types/v1/integration/googleSheet";
import GoBackButton from "@formbricks/ui/GoBackButton";

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

  const googleSheetIntegration: TIntegrationGoogleSheets | undefined = integrations?.find(
    (integration): integration is TIntegrationGoogleSheets => integration.type === "googleSheets"
  );
  let spreadSheetArray: TIntegrationItem[] = [];
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
