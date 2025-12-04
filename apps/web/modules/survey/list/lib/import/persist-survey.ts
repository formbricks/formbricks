import { createId } from "@paralleldrive/cuid2";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { createSurvey } from "@/modules/survey/components/template-list/lib/survey";
import { type TMappedTrigger } from "./map-triggers";
import { type TSurveyLanguageConnection } from "./normalize-survey";

export const persistSurvey = async (
  environmentId: string,
  survey: TSurveyCreateInput,
  newName: string,
  createdBy: string,
  mappedTriggers: TMappedTrigger[],
  mappedLanguages?: TSurveyLanguageConnection
): Promise<{ surveyId: string }> => {
  const followUpsWithNewIds = survey.followUps?.map((f) => ({
    ...f,
    id: createId(),
    surveyId: createId(),
  }));

  const surveyToCreate = {
    ...survey,
    name: newName,
    status: "draft" as const,
    triggers: mappedTriggers as any, // Type system expects full ActionClass, but createSurvey only uses the id
    followUps: followUpsWithNewIds,
    createdBy,
    ...(mappedLanguages && { languages: mappedLanguages as any }), // Prisma nested create format
  } as TSurveyCreateInput;

  const newSurvey = await createSurvey(environmentId, surveyToCreate);

  return { surveyId: newSurvey.id };
};
