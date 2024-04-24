"use client";

// import { motion } from "framer-motion";
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
    console.log(cardIndexTemp);
    return cardIndexTemp;
  }, [survey]);

  cardIndexes;
  const questionIdx = useMemo(() => {
    if (currentQuestionId === "start") return -1;
    else if (currentQuestionId === "end") return survey.questions.length;
    return survey.questions.findIndex((question) => question.id === currentQuestionId);
  }, [currentQuestionId]);
  console.log(questionIdx);
  switch (cardArrangement) {
    case "casual":
      return (
        <div className="group relative">
          <div className="opacity-0">{getCardContent(questionIdx)}</div>
          {questionIdx !== undefined &&
            cardIndexes.map((_, idx) => {
              const index = survey.welcomeCard.enabled ? idx - 1 : idx;
              return (
                <div
                  id={`questionCard-${index}`}
                  key={index}
                  style={{ zIndex: 1000 - index }}
                  className={`absolute inset-x-0 h-[${100 - 5 * (index - questionIdx)}%] w-[${100 - 2 * (index - questionIdx)}%] -rotate-${3 * (index - questionIdx)} rounded-xl border border-slate-200 bg-white opacity-${100 - 30 * (index - questionIdx)} top-0 backdrop-blur-md transition-all duration-1000 ease-in-out ${index - questionIdx < 0 ? "translate-x-[50rem] opacity-0" : `scale-100 opacity-${100 - 30 * (index - questionIdx)}`} inset-0`}>
                  {getCardContent(index)}
                </div>
              );
            })}
        </div>
      );
    case "straight":
      return (
        <div className="group relative">
          <div className="opacity-0">{getCardContent(questionIdx)}</div>
          {questionIdx !== undefined &&
            cardIndexes.map((_, idx) => {
              const index = survey.welcomeCard.enabled ? idx - 1 : idx;
              return (
                <div
                  id={`questionCard-${index}`}
                  key={index}
                  style={{
                    zIndex: 1000 - index,
                  }}
                  className={`absolute w-full -translate-y-${3 * (index - questionIdx)} rounded-xl border border-slate-200 bg-white opacity-${100 - 30 * (index - questionIdx)} top-0 backdrop-blur-md transition-all duration-1000 ease-in-out ${index - questionIdx < 0 ? "translate-x-[50rem] opacity-0" : `scale-100 opacity-${100 - 30 * (index - questionIdx)}`} inset-y-0`}>
                  {getCardContent(index)}
                </div>
              );
            })}
        </div>
      );

    default:
      return (
        <div className="group relative">
          <div className="opacity-0">{getCardContent(questionIdx)}</div>
          {questionIdx !== undefined &&
            cardIndexes.map((_, idx) => {
              const index = survey.welcomeCard.enabled ? idx - 1 : idx;
              return (
                <div
                  id={`questionCard-${index}`}
                  key={index}
                  style={{
                    zIndex: 1000 - index,
                  }}
                  className={`absolute w-full rounded-xl border border-slate-200 bg-white opacity-${100 - 30 * (index - questionIdx)} top-0 backdrop-blur-md transition-all duration-1000 ease-in-out ${index - questionIdx < 0 ? "translate-x-[50rem] opacity-0" : `scale-100 opacity-${100 - 30 * (index - questionIdx)}`} inset-y-0`}>
                  {getCardContent(index)}
                </div>
              );
            })}
        </div>
      );
  }
};
