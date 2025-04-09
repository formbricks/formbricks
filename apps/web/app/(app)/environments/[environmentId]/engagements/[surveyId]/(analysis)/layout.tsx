import { authOptions } from "@/modules/auth/lib/authOptions";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";

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
  return <>{children}</>;
};

export default SurveyLayout;
