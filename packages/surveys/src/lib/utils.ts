import { TSurvey, TSurveyChoice } from "@formbricks/types/surveys/types";

export const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

const shuffle = (array: any[]) => {
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const getShuffledChoicesIds = (choices: TSurveyChoice[], shuffleOption: string): string[] => {
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

export const calculateElementIdx = (survey: TSurvey, currentQustionIdx: number): number => {
  const currentQuestion = survey.questions[currentQustionIdx];
  const surveyLength = survey.questions.length;
  const middleIdx = Math.floor(surveyLength / 2);
  const possibleNextQuestions = currentQuestion?.logic?.map((l) => l.destination) || [];

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
  return elementIdx;
};
