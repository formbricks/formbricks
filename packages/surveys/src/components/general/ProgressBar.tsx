import { TSurvey } from "@formbricks/types/surveys";
import Progress from "./Progress";
import { calculateElementIdx } from "@/lib/utils";
import { useCallback, useMemo } from "preact/hooks";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: string;
}

export default function ProgressBar({ survey, questionId }: ProgressBarProps) {
  const currentQuestionIdx = survey.questions.findIndex((e) => e.id === questionId);

  const calculateProgress = useCallback((questionId: string, survey: TSurvey, progress: number) => {
    if (survey.questions.length === 0) return 0;
    let currentQustionIdx = survey.questions.findIndex((e) => e.id === questionId);
    if (currentQustionIdx === -1) currentQustionIdx = 0;
    const elementIdx = calculateElementIdx(survey, currentQustionIdx);

    const newProgress = elementIdx / survey.questions.length;
    let updatedProgress = progress;
    if (newProgress > progress) {
      updatedProgress = newProgress;
    } else if (newProgress <= progress && progress + 0.1 <= 1) {
      updatedProgress = progress + 0.1;
    }
    return updatedProgress;
  }, []);

  const progressArray = useMemo(() => {
    let progress = 0;
    let progressArrayTemp: number[] = [];
    survey.questions.forEach((question) => {
      progress = calculateProgress(question.id, survey, progress);
      progressArrayTemp.push(progress);
    });
    return progressArrayTemp;
  }, [calculateProgress, survey]);

  return <Progress progress={questionId === "end" ? 1 : progressArray[currentQuestionIdx]} />;
}
