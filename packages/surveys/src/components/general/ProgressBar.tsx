import { TSurvey } from "@formbricks/types/surveys";
import { useEffect, useState } from "preact/hooks";
import Progress from "./Progress";
import { calculateElementIdx } from "@/lib/utils";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: string;
}

export default function ProgressBar({ survey, questionId }: ProgressBarProps) {
  const [progress, setProgress] = useState(0); // [0, 1]

  useEffect(() => {
    // calculate progress
    setProgress(calculateProgress(questionId, survey));
    function calculateProgress(questionId: string, survey: TSurvey) {
      if (survey.questions.length === 0) return 0;
      if (questionId === "start") return 0;
      if (questionId === "end") return 1;

      let currentQustionIdx = survey.questions.findIndex((e) => e.id === questionId);
      if (currentQustionIdx === -1) currentQustionIdx = 0;

      const elementIdx = calculateElementIdx(survey, currentQustionIdx);

      const newProgress = Number((elementIdx / survey.questions.length).toFixed(2));
      return newProgress;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, survey]);

  return <Progress progress={progress} />;
}
