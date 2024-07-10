import { calculateElementIdx } from "@/lib/utils";
import { useCallback, useMemo } from "preact/hooks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Progress } from "./Progress";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: string;
}

export const ProgressBar = ({ survey, questionId }: ProgressBarProps) => {
  const currentQuestionIdx = useMemo(
    () => survey.questions.findIndex((q) => q.id === questionId),
    [survey, questionId]
  );

  const calculateProgress = useCallback(
    (index: number, questionsLength: number) => {
      if (questionsLength === 0) return 0;
      if (index === -1) index = 0;

      const elementIdx = calculateElementIdx(survey, index);
      return elementIdx / questionsLength;
    },
    [survey]
  );

  const progressArray = useMemo(() => {
    return survey.questions.map((_, index) => calculateProgress(index, survey.questions.length));
  }, [calculateProgress, survey]);

  return (
    <Progress
      progress={
        questionId.includes("end:") ? 1 : questionId === "start" ? 0 : progressArray[currentQuestionIdx]
      }
    />
  );
};
