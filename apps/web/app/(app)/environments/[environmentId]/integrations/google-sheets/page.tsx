import { getSurveysWithAnalytics } from "@formbricks/lib/services/survey"
import GoBackButton from "@/components/shared/GoBackButton";
import SurveySelect from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/SurveySelect";
import Image from "next/image";
import GoogleSheetsLogo from "@/images/google-sheets-small.png";
import FormbricksGoogleSheet from "@/images/formbricks-googlesheet.png"
import { Button } from "@formbricks/ui";

export default async function GoogleSheet({ params }) {
    const surveys = await getSurveysWithAnalytics(params.environmentId)
    return (
        <>
       
            <GoBackButton />
        <div className="flex flex-col justify-center items-center">
            <div className="flex items-center ">
                <Image src={GoogleSheetsLogo} className="h-8 w-6 mr-4" alt="Google sheets Logo" />
                <h1 className="my-2 text-3xl font-bold text-slate-800">Google Sheets Intergation</h1>
            </div>
            <div className="flex flex-col items-center justify-center w-1/2 mt-4">

                <p className="">Elevate your survey experience with FormBricks' cutting-edge integration with Google Sheets. We've revolutionized the way you manage and analyze survey data, making it easier than ever to transform responses into actionable insights.

                    Instant Data Flow: No more manual data entry. With FormBricks' Google Sheets integration, survey responses flow effortlessly from FormBricks to your Google Sheet in real-time. Say goodbye to tedious tasks and hello to accuracy and efficiency.

                    Visualize Your Data: Once your data lands in Google Sheets, the power of visualization is at your fingertips. Leverage Google Sheets' robust graphing tools to create dynamic charts, graphs, and tables that give life to your survey results.

                    Customization Made Easy: FormBricks' integration allows you to organize and structure your data the way you want. Apply formulas, filters, and conditional formatting to craft a tailored data analysis experience that suits your needs.</p>
                <Image className="w-1/2" src={FormbricksGoogleSheet} alt="Formbricks google sheet Integration" />
                <Button variant="secondary">Connect you google account</Button>;
                {/* <SurveySelect surveys={surveys} environmentId={params.environmentId} />  */}
            </div>
        </div>
        </>
    )
}
