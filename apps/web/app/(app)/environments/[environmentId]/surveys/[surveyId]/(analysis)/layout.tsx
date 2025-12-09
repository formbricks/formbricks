import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

type Props = {
  params: Promise<{ surveyId: string; environmentId: string }>;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const survey = await getSurvey(params.surveyId);
  const responseCount = await getResponseCountBySurveyId(params.surveyId);

  if (session) {
    return {
      title: `${responseCount} Responses | ${survey?.name} Results`,
    };
  }
  return {
    title: "",
  };
};

const SurveyLayout = async ({ children }) => {
  return <ResponseFilterProvider>{children}</ResponseFilterProvider>;
};

export default SurveyLayout;
