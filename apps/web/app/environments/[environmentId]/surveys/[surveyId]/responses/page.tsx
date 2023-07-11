export const revalidate = 0;
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";
import ResponsePage from "@/app/environments/[environmentId]/surveys/[surveyId]/responses/ResponsePage";

export default async function Page({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const { responses, survey } = await getAnalysisData(session, params.surveyId, params.environmentId);
  return (
    <>
      <ResponsesLimitReachedBanner
        environmentId={params.environmentId}
        surveyId={params.surveyId}
        session={session}
      />
      <ResponsePage
        environmentId={params.environmentId}
        responses={responses}
        survey={survey}
        surveyId={params.surveyId}
      />
    </>
  );
}
