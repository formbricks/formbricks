import { getSurveys } from "@formbricks/lib/services/survey";
import GoogleSheetWrapper from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/GoogleSheetWrapper";
import GoBackButton from "@/components/shared/GoBackButton";
import { getSpreadSheets } from "@formbricks/lib/services/googleSheet";
import { getIntegrations } from "@formbricks/lib/services/integrations";
import { TGoogleSheetIntegration, TGoogleSpreadsheet } from "@formbricks/types/v1/integrations";
import { WEBAPP_URL } from "@formbricks/lib/constants";

export default async function GoogleSheet({ params }) {
  const surveys = await getSurveys(params.environmentId);
  let spreadSheetArray: TGoogleSpreadsheet[] = [];
  const integrations = await getIntegrations(params.environmentId);
  const googleSheetIntegration: TGoogleSheetIntegration | undefined = integrations?.find(
    (integration): integration is TGoogleSheetIntegration => integration.type === "googleSheets"
  );
  if (googleSheetIntegration && googleSheetIntegration.config.key) {
    spreadSheetArray = await getSpreadSheets(params.environmentId);
  }
  return (
    <>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <div className="h-[75vh] w-full">
        <GoogleSheetWrapper
          environmentId={params.environmentId}
          surveys={surveys}
          spreadSheetArray={spreadSheetArray}
          googleSheetIntegration={googleSheetIntegration}
        />
      </div>
    </>
  );
}
