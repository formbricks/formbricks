import { TResponseTtc } from "@formbricks/types/responses";
import { useEffect } from "react";
export const getUpdatedTtc = (ttc: TResponseTtc, questionId: string, time: number) => {
  // Check if the question ID already exists
  if (ttc.hasOwnProperty(questionId)) {
    return {
      ...ttc,
      [questionId]: ttc[questionId] + time,
    };
  } else {
    // If the question ID does not exist, add it to the object
    return {
      ...ttc,
      [questionId]: time,
    };
  }
};

export const useTtc = (
  questionId: string,
  ttc: TResponseTtc,
  setTtc: (ttc: TResponseTtc) => void,
  startTime: number,
  setStartTime: (time: number) => void
) => {
  useEffect(() => {
    setStartTime(performance.now());
  }, [questionId]);

  useEffect(() => {
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
  }, []);
};
