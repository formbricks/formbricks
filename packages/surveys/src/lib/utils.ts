import { TSurvey } from "@formbricks/types/surveys";

export const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

const shuffle = (array: any[]) => {
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const shuffleQuestions = (array: any[], shuffleOption: string) => {
  const arrayCopy = [...array];
  const otherIndex = arrayCopy.findIndex((element) => element.id === "other");
  const otherElement = otherIndex !== -1 ? arrayCopy.splice(otherIndex, 1)[0] : null;

  if (shuffleOption === "all") {
    shuffle(arrayCopy);
  } else if (shuffleOption === "exceptLast") {
    const lastElement = arrayCopy.pop();
    shuffle(arrayCopy);
    arrayCopy.push(lastElement);
  }

  if (otherElement) {
    arrayCopy.push(otherElement);
  }

  return arrayCopy;
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
