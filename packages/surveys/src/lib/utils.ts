import { MutableRef, useEffect } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import {
  type TShuffleOption,
  type TSurveyLogic,
  type TSurveyLogicAction,
  type TSurveyQuestion,
  type TSurveyQuestionChoice,
} from "@formbricks/types/surveys/types";

export const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

const shuffle = (array: unknown[]) => {
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const getShuffledRowIndices = (n: number, shuffleOption: TShuffleOption): number[] => {
  // Create an array with numbers from 0 to n-1
  const array = Array.from(Array(n).keys());

  if (shuffleOption === "all") {
    shuffle(array);
  } else if (shuffleOption === "exceptLast") {
    const lastElement = array.pop();
    if (lastElement) {
      shuffle(array);
      array.push(lastElement);
    }
  }
  return array;
};

export const getShuffledChoicesIds = (
  choices: TSurveyQuestionChoice[],
  shuffleOption: TShuffleOption
): string[] => {
  const otherOption = choices.find((choice) => {
    return choice.id === "other";
  });
  const shuffledChoices = otherOption ? [...choices.filter((choice) => choice.id !== "other")] : [...choices];

  if (shuffleOption === "all") {
    shuffle(shuffledChoices);
  } else if (shuffleOption === "exceptLast") {
    if (otherOption) {
      shuffle(shuffledChoices);
    } else {
      const lastElement = shuffledChoices.pop();
      if (lastElement) {
        shuffle(shuffledChoices);
        shuffledChoices.push(lastElement);
      }
    }
  }
  if (otherOption) shuffledChoices.push(otherOption);

  return shuffledChoices.map((choice) => choice.id);
};

export const calculateElementIdx = (
  survey: TJsEnvironmentStateSurvey,
  currentQustionIdx: number,
  totalCards: number
): number => {
  const currentQuestion = survey.questions[currentQustionIdx];
  const middleIdx = Math.floor(totalCards / 2);
  const possibleNextQuestions = getPossibleNextQuestions(currentQuestion);
  const endingCardIds = survey.endings.map((ending) => ending.id);
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
  if (possibleNextQuestions.some((id) => endingCardIds.includes(id))) elementIdx = middleIdx;
  return elementIdx;
};

const getPossibleNextQuestions = (question: TSurveyQuestion): string[] => {
  if (!question.logic) return [];

  const possibleDestinations: string[] = [];

  question.logic.forEach((logic: TSurveyLogic) => {
    logic.actions.forEach((action: TSurveyLogicAction) => {
      if (action.objective === "jumpToQuestion") {
        possibleDestinations.push(action.target);
      }
    });
  });

  return possibleDestinations;
};

// Improved version of https://usehooks.com/useOnClickOutside/
export const useClickOutside = (
  ref: MutableRef<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void
): void => {
  useEffect(() => {
    let startedInside = false;
    let startedWhenMounted = false;

    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if `mousedown` or `touchstart` started inside ref element
      if (startedInside || !startedWhenMounted) return;
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target as Node)) return;

      handler(event);
    };

    const validateEventStart = (event: MouseEvent | TouchEvent) => {
      startedWhenMounted = ref.current !== null;
      startedInside = ref.current !== null && ref.current.contains(event.target as Node);
    };

    document.addEventListener("mousedown", validateEventStart);
    document.addEventListener("touchstart", validateEventStart);
    document.addEventListener("click", listener);

    return () => {
      document.removeEventListener("mousedown", validateEventStart);
      document.removeEventListener("touchstart", validateEventStart);
      document.removeEventListener("click", listener);
    };
  }, [ref, handler]);
};
