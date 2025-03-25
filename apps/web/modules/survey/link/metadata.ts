import { getSurveyMetadata } from "@/modules/survey/link/lib/survey";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TSurveyEnding, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TSurveyLogic } from "@formbricks/types/surveys/types";
import { TSurveyLogicAction } from "@formbricks/types/surveys/types";
import { getBrandColorForURL, getNameForURL, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";

export const getMetadataForLinkSurvey = async (surveyId: string): Promise<Metadata> => {
  const survey = await getSurveyMetadata(surveyId);

  if (!survey || survey.type !== "link" || survey.status === "draft") {
    notFound();
  }

  const getPossibleNextQuestions = (question: TSurveyQuestion): string[] => {
    if (!question.logic) return [];

    const possibleDestinations: string[] = [];

    question.logic.forEach((logic: TSurveyLogic) => {
      logic.actions.forEach((action: TSurveyLogicAction) => {
        if (action.objective === "jumpToQuestion") {
          possibleDestinations.push(action.target);
        }
      });
    });

    return possibleDestinations;
  };

  const calculateElementIdx = (
    questions: TSurveyQuestion[],
    endings: TSurveyEnding[],
    currentQustionIdx: number,
    totalCards: number
  ): number => {
    const currentQuestion = questions[currentQustionIdx];
    const middleIdx = Math.floor(totalCards / 2);
    const possibleNextQuestions = getPossibleNextQuestions(currentQuestion);
    const endingCardIds = endings.map((ending) => ending.id);
    const getLastQuestionIndex = () => {
      const lastQuestion = questions
        .filter((q) => possibleNextQuestions.includes(q.id))
        .sort((a, b) => questions.indexOf(a) - questions.indexOf(b))
        .pop();
      return questions.findIndex((e) => e.id === lastQuestion?.id);
    };

    let elementIdx = currentQustionIdx || 0.5;
    const lastprevQuestionIdx = getLastQuestionIndex();

    if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
    if (possibleNextQuestions.some((id) => endingCardIds.includes(id))) elementIdx = middleIdx;
    return elementIdx;
  };

  const calculateTimeToComplete = (questions: TSurveyQuestion[], endings: TSurveyEnding[]) => {
    let totalCards = questions.length;
    if (endings.length > 0) totalCards += 1;
    let idx = calculateElementIdx(questions, endings, 0, totalCards);
    if (idx === 0.5) {
      idx = 1;
    }
    const timeInSeconds = (questions.length / idx) * 15; //15 seconds per question.
    if (timeInSeconds > 360) {
      // If it's more than 6 minutes
      return "6+ minutes";
    }
    // Calculate minutes, if there are any seconds left, add a minute
    const minutes = Math.floor(timeInSeconds / 60);
    const remainingSeconds = timeInSeconds % 60;

    if (remainingSeconds > 0) {
      // If there are any seconds left, we'll need to round up to the next minute
      if (minutes === 0) {
        // If less than 1 minute, return 'less than 1 minute'
        return "less than 1 minute";
      }
      // If more than 1 minute, return 'less than X minutes', where X is minutes + 1
      return `less than ${(minutes + 1).toString()} minutes`;
    }
    // If there are no remaining seconds, just return the number of minutes
    return `${minutes.toString()} minutes`;
  };

  const brandColor = getBrandColorForURL(survey.styling?.brandColor?.light ?? COLOR_DEFAULTS.brandColor);
  const surveyName = getNameForURL(survey.name);
  const ogImgURL = `/api/v1/og?brandColor=${brandColor}&name=${surveyName}&timeToFinish=${calculateTimeToComplete(survey.questions, survey.endings)}`;

  // Use the shared function for creating the base metadata but override with specific OpenGraph data
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, survey.name);

  // Override with the custom image URL that uses the survey's brand color
  if (baseMetadata.openGraph) {
    baseMetadata.openGraph.images = [ogImgURL];
  }

  if (baseMetadata.twitter) {
    baseMetadata.twitter.images = [ogImgURL];
  }

  return {
    title: survey.name,
    ...baseMetadata,
  };
};
