import { TSurvey } from "@formbricks/types/v1/surveys";
import { useEffect, useState } from "preact/hooks";
import Progress from "./Progress";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: string;
  brandColor: string;
}

const PROGRESS_INCREMENT = 0.1;

export default function ProgressBar({ survey, questionId, brandColor }: ProgressBarProps) {
  const [progress, setProgress] = useState(0); // [0, 1]
  const [prevQuestionIdx, setPrevQuestionIdx] = useState(0); // [0, survey.questions.length

  useEffect(() => {
    // calculate progress
    setProgress(calculateProgress(questionId, survey, progress));

    function calculateProgress(currentQuestionId: string, survey: TSurvey, currentProgress: number) {
      if (currentQuestionId === "end") return 1;

      const progressArray: number[] = new Array(survey.questions.length).fill(undefined);
      const currentprevQuestionIdx = survey.questions.findIndex((e) => e.id === currentQuestionId);
      const currentQuestion = survey.questions[currentprevQuestionIdx];
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

      let elementIdx = currentprevQuestionIdx || 0.5;
      const lastprevQuestionIdx = getLastQuestionIndex();

      if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
      if (possibleNextQuestions.includes("end")) elementIdx = middleIdx;

      const newProgress = elementIdx / survey.questions.length;

      // Determine if user went backwards in the survey
      const didUserGoBackwards = currentprevQuestionIdx < prevQuestionIdx;

      // Update the progress array based on user's navigation
      let updatedProgress = currentProgress;
      if (didUserGoBackwards) {
        if (!progressArray[currentprevQuestionIdx]) {
          progressArray[currentprevQuestionIdx] = currentProgress - PROGRESS_INCREMENT;
        }
        updatedProgress = progressArray[currentprevQuestionIdx];
      } else if (newProgress > currentProgress) {
        progressArray[currentprevQuestionIdx] = newProgress;
        updatedProgress = newProgress;
      } else if (newProgress <= currentProgress && currentProgress + PROGRESS_INCREMENT <= 1) {
        progressArray[currentprevQuestionIdx] = currentProgress + PROGRESS_INCREMENT;
        updatedProgress = currentProgress + PROGRESS_INCREMENT;
      }

      setPrevQuestionIdx(currentprevQuestionIdx);
      return updatedProgress;
    }
  }, [questionId, survey, setPrevQuestionIdx]);

  return <Progress progress={progress} brandColor={brandColor} />;
}
