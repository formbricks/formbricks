import { Metadata } from 'next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { getServerSession } from 'next-auth';
import { getAnalysisData } from '@/app/environments/[environmentId]/surveys/[surveyId]/summary/data';

export const generateMetadata = async ( {params} ): Promise<Metadata> => {
  const session = await getServerSession(authOptions);
  
  if (session) {
    const { responsesCount } = await getAnalysisData(session, params.surveyId);
    return {
      title: `${responsesCount} Responses`,
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
