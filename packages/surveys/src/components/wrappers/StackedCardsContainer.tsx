"use client";

import { useMemo, useState } from "preact/hooks";

import { TProductStyling } from "@formbricks/types/product";
import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurvey, TSurveyStyling, TSurveyType } from "@formbricks/types/surveys";

interface StackedCardsContainerProps {
  cardArrangement: TCardArrangementOptions;
  currentQuestionId: string;
  survey: TSurvey;
  getCardContent: (questionIdx: number, offset: number) => JSX.Element | undefined;
  styling: TProductStyling | TSurveyStyling;
}

export const StackedCardsContainer = ({
  cardArrangement,
  currentQuestionId,
  survey,
  getCardContent,
  styling,
}: StackedCardsContainerProps) => {
  const [hovered, setHovered] = useState(false);
  const highlightBorderColor =
    survey.styling?.highlightBorderColor?.light || styling.highlightBorderColor?.light;
  const cardBorderColor = survey.styling?.cardBorderColor?.light || styling.cardBorderColor?.light;

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

  const calculateCardTransform = (offset: number) => {
    switch (cardArrangement) {
      case "casual":
        return offset < 0 ? `translateX(100%)` : `translateX(0) rotate(-${(hovered ? 4 : 2) * offset}deg)`;
      case "straight":
        return offset < 0 ? `translatey(100%)` : `translateY(-${(hovered ? 12 : 10) * offset}px)`;
      default:
        return offset < 0 ? `translateX(100%)` : `translateX(0)`;
    }
  };

  const straightCardArrangementClasses = (offset: number) => {
    if (cardArrangement === "straight") {
      return {
        width: `${100 - 2 * offset}%`,
        margin: "auto",
      };
    }
  };

  const borderStyles = (surveyType: TSurveyType) => {
    if (surveyType === "link") {
      return {
        border: "2px solid",
        borderColor: cardBorderColor,
        borderRadius: "var(--fb-border-radius)",
      };
    } else {
      if (!!highlightBorderColor) {
        return {
          border: "2px solid",
          borderColor: highlightBorderColor,
          borderRadius: "var(--fb-border-radius)",
        };
      } else {
        return {
          border: "2px solid",
          borderColor: cardBorderColor,
          borderRadius: "var(--fb-border-radius)",
        };
      }
    }
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}>
      <div className="opacity-0">{getCardContent(questionIdx, 0)}</div>
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
                transform: calculateCardTransform(offset),
                opacity: isHidden ? 0 : (100 - 30 * offset) / 100,
                pointerEvents: isHidden ? "none" : "auto",
                ...straightCardArrangementClasses(offset),
                ...borderStyles(survey.type),
              }}
              className="pointer rounded-custom absolute inset-0 top-0 backdrop-blur-md transition-all duration-1000 ease-in-out  ">
              {getCardContent(index, offset)}
            </div>
          );
        })}
    </div>
  );
};
