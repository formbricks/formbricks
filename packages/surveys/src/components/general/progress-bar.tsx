import { Progress } from "@/components/general/progress";
import { calculateElementIdx } from "@/lib/utils";
import { useCallback, useMemo } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface ProgressBarProps {
  survey: TJsEnvironmentStateSurvey;
  questionId: TSurveyQuestionId;
}

export function ProgressBar({ survey, questionId }: ProgressBarProps) {
  const currentQuestionIdx = useMemo(
    () => survey.questions.findIndex((q) => q.id === questionId),
    [survey, questionId]
  );
  const endingCardIds = useMemo(() => survey.endings.map((ending) => ending.id), [survey.endings]);

  const calculateProgress = useCallback(
    (index: number) => {
      let totalCards = survey.questions.length;
      if (endingCardIds.length > 0) totalCards += 1;
      let idx = index;

      if (index === -1) idx = 0;

      const elementIdx = calculateElementIdx(survey, idx, totalCards);
      return elementIdx / totalCards;
    },
    [survey]
  );

  const progressArray = useMemo(() => {
    return survey.questions.map((_, index) => calculateProgress(index));
  }, [calculateProgress, survey]);

  const progressValue = useMemo(() => {
    if (questionId === "start") {
      return 0;
    } else if (endingCardIds.includes(questionId)) {
      return 1;
    }
    return progressArray[currentQuestionIdx];
  }, [questionId, endingCardIds, progressArray, currentQuestionIdx]);

  return <Progress progress={progressValue} />;
}
