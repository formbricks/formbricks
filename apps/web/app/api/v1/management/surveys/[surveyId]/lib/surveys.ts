import { deleteSurvey as deleteSharedSurvey } from "@/modules/survey/lib/surveys";

export const deleteSurvey = async (surveyId: string) => deleteSharedSurvey(surveyId);
