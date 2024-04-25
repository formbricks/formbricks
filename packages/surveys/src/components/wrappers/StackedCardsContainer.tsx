"use client";

import { useMemo } from "preact/hooks";

import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurvey } from "@formbricks/types/surveys";

interface StackedCardsContainerProps {
  cardArrangement: TCardArrangementOptions;
  currentQuestionId: string;
  survey: TSurvey;
  getCardContent: (questionIdx: number) => JSX.Element | undefined;
}

export const StackedCardsContainer = ({
  cardArrangement,
  currentQuestionId,
  survey,
  getCardContent,
}: StackedCardsContainerProps) => {
  const cardIndexes = useMemo(() => {
    let cardIndexTemp = survey.questions.map((_, index) => index);
    if (survey.welcomeCard.enabled) {
      cardIndexTemp.unshift(-1);
    }
    if (survey.thankYouCard.enabled) {
      cardIndexTemp.push(survey.questions.length);
    }
    return cardIndexTemp;
  }, [survey]);

  const questionIdx = useMemo(() => {
    if (currentQuestionId === "start" && survey.welcomeCard.enabled) return -1;
    else if (currentQuestionId === "start" && !survey.welcomeCard.enabled) return 0;
    else if (currentQuestionId === "end" && survey.thankYouCard.enabled) return survey.questions.length;
    else if (currentQuestionId === "end" && !survey.thankYouCard.enabled) return 0;
    return survey.questions.findIndex((question) => question.id === currentQuestionId);
  }, [currentQuestionId, survey.welcomeCard.enabled, survey.thankYouCard.enabled]);

  const getTransformClasses = (offset: number) => {
    switch (cardArrangement) {
      case "casual":
        return offset < 0 ? `translateX(100vw)` : `translateX(0) rotate(-${3 * offset}deg)`;
      case "straight":
        return offset < 0 ? `translateX(100vw)` : `translateX(0) translateY(-${10 * offset}px)`;
      default:
        return offset < 0 ? `translateX(100vw)` : `translateX(0)`;
    }
  };

  return (
    <div className="group relative">
      <div className="opacity-0">{getCardContent(questionIdx)}</div>
      {questionIdx !== undefined &&
        cardIndexes.map((_, idx) => {
          const index = survey.welcomeCard.enabled ? idx - 1 : idx;
          const offset = index - questionIdx;
          const isHidden = offset < 0;
          return (
            <div
              id={`questionCard-${index}`}
              key={index}
              style={{
                zIndex: 1000 - index,
                transform: getTransformClasses(offset),
                opacity: isHidden ? 0 : (100 - 30 * offset) / 100,
              }}
              className="absolute inset-0 top-0 rounded-xl border border-slate-200 bg-white backdrop-blur-md transition-all duration-1000 ease-in-out">
              {getCardContent(index)}
            </div>
          );
        })}
    </div>
  );
};
