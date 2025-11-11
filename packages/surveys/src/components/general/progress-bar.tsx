import { useCallback, useMemo } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { Progress } from "@/components/general/progress";
import { calculateElementIdx, getElementsFromSurvey } from "@/lib/utils";

interface ProgressBarProps {
  survey: TJsEnvironmentStateSurvey;
  questionId: string;
}

export function ProgressBar({ survey, questionId }: ProgressBarProps) {
  const questions = useMemo(() => getElementsFromSurvey(survey), [survey]);
  const currentQuestionIdx = useMemo(
    () => questions.findIndex((q) => q.id === questionId),
    [questions, questionId]
  );

  const endingCardIds = useMemo(() => survey.endings.map((ending) => ending.id), [survey.endings]);

  const calculateProgress = useCallback(
    (index: number) => {
      let totalCards = survey.blocks.length;
      if (endingCardIds.length > 0) totalCards += 1;
      let idx = index;

      if (index === -1) idx = 0;

      const elementIdx = calculateElementIdx(survey, idx, totalCards);
      return elementIdx / totalCards;
    },
    [survey, endingCardIds.length]
  );

  const progressArray = useMemo(() => {
    return questions.map((_, index) => calculateProgress(index));
  }, [calculateProgress, questions]);

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
