import GoBackButton from "@/components/shared/GoBackButton";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  WEBAPP_URL,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import Connect from "@/app/(app)/environments/[environmentId]/integrations/slack/Connect";

export default async function GoogleSheet({ params }) {
  const enabled = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET && GOOGLE_SHEETS_REDIRECT_URL);
  const [environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }

  // const googleSheetIntegration: TGoogleSheetIntegration | undefined = integrations?.find(
  //   (integration): integration is TGoogleSheetIntegration => integration.type === "googleSheets"
  // );
  // let spreadSheetArray: TGoogleSpreadsheet[] = [];
  // if (googleSheetIntegration && googleSheetIntegration.config.key) {
  //   spreadSheetArray = await getSpreadSheets(params.environmentId);
  // }
  return (
    <>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <Connect enabled={enabled} environmentId={environment.id} webAppUrl={WEBAPP_URL} />
    </>
  );
}
