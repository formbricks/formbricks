import { notFound } from "next/navigation";
import { SurveyContextWrapper } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/context/survey-context";
import { getSurvey } from "@/lib/survey/service";
import { getSurveyAuth } from "@/modules/survey/lib/survey-auth";

interface SurveyLayoutProps {
  params: Promise<{ surveyId: string; workspaceId: string }>;
  children: React.ReactNode;
}

const SurveyLayout = async ({ params, children }: Readonly<SurveyLayoutProps>) => {
  const resolvedParams = await params;

  // The layout hands the survey to a client component, so it needs the same
  // workspace <-> survey check as the pages it wraps: a page throwing does not stop
  // this layout from rendering.
  await getSurveyAuth(resolvedParams.workspaceId, resolvedParams.surveyId);

  const survey = await getSurvey(resolvedParams.surveyId);

  if (!survey) {
    return notFound();
  }

  return <SurveyContextWrapper survey={survey}>{children}</SurveyContextWrapper>;
};

export default SurveyLayout;
