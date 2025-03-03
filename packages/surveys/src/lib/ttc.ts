import { useEffect } from "react";
import { type TResponseTtc } from "@formbricks/types/responses";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

export const getUpdatedTtc = (ttc: TResponseTtc, questionId: TSurveyQuestionId, time: number) => {
  // Check if the question ID already exists
  if (questionId in ttc) {
    return {
      ...ttc,
      [questionId]: ttc[questionId] + time,
    };
  }
  // If the question ID does not exist, add it to the object
  return {
    ...ttc,
    [questionId]: time,
  };
};

export const useTtc = (
  questionId: TSurveyQuestionId,
  ttc: TResponseTtc,
  setTtc: (ttc: TResponseTtc) => void,
  startTime: number,
  setStartTime: (time: number) => void,
  isCurrentQuestion: boolean
) => {
  useEffect(() => {
    if (!isCurrentQuestion) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        setStartTime(performance.now());
      } else {
        const updatedTtc = getUpdatedTtc(ttc, questionId, performance.now() - startTime);
        setTtc(updatedTtc);
      }
    };

    // Attach the event listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Clean up the event listener when the component is unmounted
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [questionId, setStartTime, setTtc, startTime, ttc, isCurrentQuestion]);

  useEffect(() => {
    if (isCurrentQuestion) {
      setStartTime(performance.now());
    }
  }, [questionId, setStartTime, isCurrentQuestion]);
};
