export const revalidate = 0;
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import ResponsePage from "@/app/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/ResponsePage";
import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/data";
import { getServerSession } from "next-auth";
import ResponsesLimitReachedBanner from "../ResponsesLimitReachedBanner";

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
