import { TSurvey } from "@formbricks/types/surveys";
import { useEffect, useState } from "preact/hooks";
import Progress from "./Progress";
import { calculateElementIdx } from "../lib/utils";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: string;
  brandColor: string;
}

const PROGRESS_INCREMENT = 0.1;

export default function ProgressBar({ survey, questionId, brandColor }: ProgressBarProps) {
  const [progress, setProgress] = useState(0); // [0, 1]
  const [prevQuestionIdx, setPrevQuestionIdx] = useState(0); // [0, survey.questions.length
  const [prevQuestionId, setPrevQuestionId] = useState(""); // [0, survey.questions.length

  useEffect(() => {
    // calculate progress
    setProgress(calculateProgress(questionId, survey, progress));
    function calculateProgress(questionId: string, survey: TSurvey, progress: number) {
      if (survey.questions.length === 0) return 0;
      if (questionId === "end") return 1;
      let currentQustionIdx = survey.questions.findIndex((e) => e.id === questionId);
      if (progress > 0 && questionId === prevQuestionId) return progress;
      if (currentQustionIdx === -1) currentQustionIdx = 0;
      const elementIdx = calculateElementIdx(survey, currentQustionIdx);

      const newProgress = elementIdx / survey.questions.length;

      // Determine if user went backwards in the survey
      const didUserGoBackwards = currentQustionIdx < prevQuestionIdx;

      // Update the progress array based on user's navigation
      let updatedProgress = progress;
      if (didUserGoBackwards) {
        updatedProgress = progress - (prevQuestionIdx - currentQustionIdx) * PROGRESS_INCREMENT;
      } else if (newProgress > progress) {
        updatedProgress = newProgress;
      } else if (newProgress <= progress && progress + PROGRESS_INCREMENT <= 1) {
        updatedProgress = progress + PROGRESS_INCREMENT;
      }
      setPrevQuestionId(questionId);
      setPrevQuestionIdx(currentQustionIdx);
      return updatedProgress;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, survey, setPrevQuestionIdx]);

  return <Progress progress={progress} brandColor={brandColor} />;
}
