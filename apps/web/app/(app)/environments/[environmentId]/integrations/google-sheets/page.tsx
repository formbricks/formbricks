import { getSurveysWithAnalytics } from "@formbricks/lib/services/survey"
import GoogleSheetWrapper from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/GoogleSheetWrapper";
import GoBackButton from "@/components/shared/GoBackButton";

export default async function GoogleSheet({ params }) {
    const surveys = await getSurveysWithAnalytics(params.environmentId)
    return (
        <>
            <GoBackButton />
            <GoogleSheetWrapper environmentId={params.environmentId} surveys={surveys} />

        </>
    )
}
