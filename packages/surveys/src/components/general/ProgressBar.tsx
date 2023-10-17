import { TSurveyWithTriggers } from "@formbricks/types/v1/js";
import { useEffect, useState } from "preact/hooks";
import Progress from "./Progress";

interface ProgressBarProps {
  survey: TSurveyWithTriggers;
  questionId: string;
}

const PROGRESS_INCREMENT = 0.1;

export default function ProgressBar({ survey, questionId }: ProgressBarProps) {
  const [progress, setProgress] = useState(0); // [0, 1]
  const [prevQuestionIdx, setPrevQuestionIdx] = useState(0); // [0, survey.questions.length

  useEffect(() => {
    // calculate progress
    setProgress(calculateProgress(questionId, survey, progress));

    function calculateProgress(questionId: string, survey: TSurveyWithTriggers, progress: number) {
      if (survey.questions.length === 0) return 0;
      if (questionId === "end") return 1;

      let currentQustionIdx = survey.questions.findIndex((e) => e.id === questionId);
      if (progress > 0 && currentQustionIdx === prevQuestionIdx) return progress;
      if (currentQustionIdx === -1) currentQustionIdx = 0;
      const currentQuestion = survey.questions[currentQustionIdx];
      const surveyLength = survey.questions.length;
      const middleIdx = Math.floor(surveyLength / 2);
      const possibleNextQuestions = currentQuestion.logic?.map((l) => l.destination) || [];

      const getLastQuestionIndex = () => {
        const lastQuestion = survey.questions
          .filter((q) => possibleNextQuestions.includes(q.id))
          .sort((a, b) => survey.questions.indexOf(a) - survey.questions.indexOf(b))
          .pop();
        return survey.questions.findIndex((e) => e.id === lastQuestion?.id);
      };

      let elementIdx = currentQustionIdx || 0.5;
      const lastprevQuestionIdx = getLastQuestionIndex();

      if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
      if (possibleNextQuestions.includes("end")) elementIdx = middleIdx;

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

      setPrevQuestionIdx(currentQustionIdx);
      return updatedProgress;
    }
  }, [questionId, survey, setPrevQuestionIdx]);

  return <Progress progress={progress} />;
}
