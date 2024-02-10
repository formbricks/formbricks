import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";

type Props = {
  params: { surveyId: string; environmentId: string };
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const session = await getServerSession(authOptions);
  const survey = await getSurvey(params.surveyId);

  if (session) {
    const responseCount = await getResponseCountBySurveyId(params.surveyId);
    return {
      title: `${responseCount} Responses | ${survey?.name} Results`,
    };
  }
  return {
    title: "",
  };
};

const SurveyLayout = ({ children }) => {
  return <div>{children}</div>;
};

export default SurveyLayout;
