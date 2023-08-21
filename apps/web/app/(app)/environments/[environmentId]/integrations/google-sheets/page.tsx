import { getSurveysWithAnalytics } from "@formbricks/lib/services/survey"
import GoogleSheetWrapper from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/GoogleSheetWrapper";
import GoBackButton from "@/components/shared/GoBackButton";
import { getSpreadSheets } from "@formbricks/lib/client/google";
import { getIntegrations } from "@formbricks/lib/services/integrations";

export default async function GoogleSheet({ params }) {
    const surveys = await getSurveysWithAnalytics(params.environmentId)
    const Spreadsheet = await getSpreadSheets(params.environmentId) 
    const integrations = await getIntegrations(params.environmentId)                                                                        
    return (
        <>
            <GoBackButton />
            <GoogleSheetWrapper environmentId={params.environmentId} surveys={surveys} Spreadsheet={Spreadsheet} integrations={integrations}/>
        </>
    )
}
