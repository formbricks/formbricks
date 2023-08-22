import { useCallback, useEffect, useState } from "preact/hooks";
import Progress from "./Progress";
import { TSurvey } from "@formbricks/types/v1/surveys";

interface ProgressBarProps {
  survey: TSurvey;
  questionId: string;
  brandColor: string;
}

const PROGRESS_INCREMENT = 0.1;

export default function ProgressBar({ survey, questionId, brandColor }: ProgressBarProps) {
  const [progress, setProgress] = useState(0); // [0, 1]

  useEffect(() => {
    // calculate progress
    setProgress(calculateProgress(questionId, survey, progress));
  }, [questionId, survey]);

  let questionIdxTemp: number;

  const calculateProgress = useCallback(
    (currentQuestionId: string, survey: TSurvey, currentProgress: number) => {
      const progressArray: number[] = new Array(survey.questions.length).fill(undefined);
      const currentQuestionIdx = survey.questions.findIndex((e) => e.id === currentQuestionId);
      const currentQuestion = survey.questions[currentQuestionIdx];
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

      let elementIdx = currentQuestionIdx || 0.5;
      const lastQuestionIdx = getLastQuestionIndex();

      if (lastQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastQuestionIdx - 1);
      if (possibleNextQuestions.includes("end")) elementIdx = middleIdx;

      const newProgress = elementIdx / survey.questions.length;

      // Determine if user went backwards in the survey
      const didUserGoBackwards = currentQuestionIdx < questionIdxTemp;

      // Update the progress array based on user's navigation
      let updatedProgress = currentProgress;
      if (didUserGoBackwards) {
        if (!progressArray[currentQuestionIdx]) {
          progressArray[currentQuestionIdx] = currentProgress - PROGRESS_INCREMENT;
        }
        updatedProgress = progressArray[currentQuestionIdx];
      } else if (newProgress > currentProgress) {
        progressArray[currentQuestionIdx] = newProgress;
        updatedProgress = newProgress;
      } else if (newProgress <= currentProgress && currentProgress + PROGRESS_INCREMENT <= 1) {
        progressArray[currentQuestionIdx] = currentProgress + PROGRESS_INCREMENT;
        updatedProgress = currentProgress + PROGRESS_INCREMENT;
      }

      questionIdxTemp = currentQuestionIdx;
      return updatedProgress;
    },
    []
  );

  return <Progress progress={progress} brandColor={brandColor} />;
}
