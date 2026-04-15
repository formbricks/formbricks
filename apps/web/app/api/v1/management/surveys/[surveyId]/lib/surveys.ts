import { deleteSurvey as deleteSharedSurvey } from "@/modules/survey/lib/delete-survey";

export const deleteSurvey = async (surveyId: string) => deleteSharedSurvey(surveyId);
