import { useCallback, useMemo } from "preact/hooks";
import { type TSurvey, type TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { calculateElementIdx } from "@/lib/utils";
import { Progress } from "./progress";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: TSurveyQuestionId;
}

export function ProgressBar({ survey, questionId }: ProgressBarProps) {
  const currentQuestionIdx = useMemo(
    () => survey.questions.findIndex((q) => q.id === questionId),
    [survey, questionId]
  );
  const endingCardIds = useMemo(() => survey.endings.map((ending) => ending.id), [survey.endings]);

  const calculateProgress = useCallback(
    (index: number, questionsLength: number) => {
      let idx = index;

      if (questionsLength === 0) return 0;
      if (index === -1) idx = 0;

      const elementIdx = calculateElementIdx(survey, idx);
      return elementIdx / questionsLength;
    },
    [survey]
  );

  const progressArray = useMemo(() => {
    return survey.questions.map((_, index) => calculateProgress(index, survey.questions.length));
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
