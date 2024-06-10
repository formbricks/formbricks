"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { TProductStyling } from "@formbricks/types/product";
import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys";

// offset = 0 -> Current question card
// offset < 0 -> Question cards that are already answered
// offset > 0 -> Question that aren't answered yet
interface StackedCardsContainerProps {
  cardArrangement: TCardArrangementOptions;
  currentQuestionId: string;
  survey: TSurvey;
  getCardContent: (questionIdxTemp: number, offset: number) => JSX.Element | undefined;
  styling: TProductStyling | TSurveyStyling;
  setQuestionId: (questionId: string) => void;
  shouldResetQuestionId?: boolean;
  fullSizeCards: boolean;
}

export const StackedCardsContainer = ({
  cardArrangement,
  currentQuestionId,
  survey,
  getCardContent,
  styling,
  setQuestionId,
  shouldResetQuestionId = true,
  fullSizeCards = false,
}: StackedCardsContainerProps) => {
  const [hovered, setHovered] = useState(false);
  const highlightBorderColor =
    survey.styling?.highlightBorderColor?.light || styling.highlightBorderColor?.light;
  const cardBorderColor = survey.styling?.cardBorderColor?.light || styling.cardBorderColor?.light;
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [cardHeight, setCardHeight] = useState("auto");

  const questionIdxTemp = useMemo(() => {
    if (currentQuestionId === "start") return survey.welcomeCard.enabled ? -1 : 0;
    if (currentQuestionId === "end") return survey.thankYouCard.enabled ? survey.questions.length : 0;
    return survey.questions.findIndex((question) => question.id === currentQuestionId);
  }, [currentQuestionId, survey.welcomeCard.enabled, survey.thankYouCard.enabled, survey.questions]);

  const [prevQuestionIdx, setPrevQuestionIdx] = useState(questionIdxTemp - 1);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(questionIdxTemp);
  const [nextQuestionIdx, setNextQuestionIdx] = useState(questionIdxTemp + 1);
  const [visitedQuestions, setVisitedQuestions] = useState<number[]>([]);

  useEffect(() => {
    if (questionIdxTemp > currentQuestionIdx) {
      // Next button is clicked
      setPrevQuestionIdx(currentQuestionIdx);
      setCurrentQuestionIdx(questionIdxTemp);
      setNextQuestionIdx(questionIdxTemp + 1);
      setVisitedQuestions((prev) => {
        return [...prev, currentQuestionIdx];
      });
    } else if (questionIdxTemp < currentQuestionIdx) {
      // Back button is clicked
      setNextQuestionIdx(currentQuestionIdx);
      setCurrentQuestionIdx(questionIdxTemp);
      setPrevQuestionIdx(visitedQuestions[visitedQuestions.length - 2]);
      setVisitedQuestions((prev) => {
        if (prev.length > 0) {
          const newStack = prev.slice(0, -1);
          return newStack;
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdxTemp]);

  const borderStyles = useMemo(() => {
    const baseStyle = {
      border: "1px solid",
      borderRadius: "var(--fb-border-radius)",
    };
    // Determine borderColor based on the survey type and availability of highlightBorderColor
    const borderColor =
      survey.type === "link" || !highlightBorderColor ? cardBorderColor : highlightBorderColor;
    return {
      ...baseStyle,
      borderColor: borderColor,
    };
  }, [survey.type, cardBorderColor, highlightBorderColor]);

  const calculateCardTransform = useMemo(() => {
    return (offset: number) => {
      switch (cardArrangement) {
        case "casual":
          return offset < 0 ? `translateX(33%)` : `translateX(0) rotate(-${(hovered ? 3 : 2.5) * offset}deg)`;
        case "straight":
          return offset < 0 ? `translateY(25%)` : `translateY(-${(hovered ? 12 : 10) * offset}px)`;
        default:
          return offset < 0 ? `translateX(0)` : `translateX(0)`;
      }
    };
  }, [cardArrangement, hovered]);

  const straightCardArrangementStyles = (offset: number) => {
    if (cardArrangement === "straight") {
      // styles to set the descending width of stacked question cards when card arrangement is set to straight
      return {
        width: `${100 - 5 * offset >= 100 ? 100 : 100 - 5 * offset}%`,
        margin: "auto",
      };
    }
  };

  // UseEffect to handle the resize of current question card and set cardHeight accordingly
  useEffect(() => {
    const currentElement = cardRefs.current[questionIdxTemp];
    if (currentElement) {
      if (resizeObserver.current) resizeObserver.current.disconnect();
      resizeObserver.current = new ResizeObserver((entries) => {
        for (const entry of entries) setCardHeight(entry.contentRect.height + "px");
      });
      resizeObserver.current.observe(currentElement);
    }
    return () => resizeObserver.current?.disconnect();
  }, [questionIdxTemp, cardArrangement]);

  // Reset question progress, when card arrangement changes
  useEffect(() => {
    if (shouldResetQuestionId) {
      setQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardArrangement]);

  const getCardHeight = (offset: number): string => {
    // Take default height depending upon card content
    if (offset === 0) return "auto";
    // Preserve original height
    else if (offset < 0) return "initial";
    // Assign the height of the foremost card to all cards behind it
    else return cardHeight;
  };

  const getBottomStyles = () => {
    if (survey.type !== "link")
      return {
        bottom: 0,
      };
  };

  return (
    <div
      className="relative flex h-full items-end justify-center md:items-center"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}>
      <div style={{ height: cardHeight }}></div>
      {cardArrangement === "simple" ? (
        <div
          className={cn("w-full", fullSizeCards ? "h-full" : "")}
          style={{
            ...borderStyles,
          }}>
          {getCardContent(questionIdxTemp, 0)}
        </div>
      ) : (
        questionIdxTemp !== undefined &&
        [prevQuestionIdx, currentQuestionIdx, nextQuestionIdx, nextQuestionIdx + 1].map(
          (questionIdxTemp, index) => {
            //Check for hiding extra card
            if (survey.thankYouCard.enabled) {
              if (questionIdxTemp > survey.questions.length) return;
            } else {
              if (questionIdxTemp > survey.questions.length - 1) return;
            }
            const offset = index - 1;
            const isHidden = offset < 0;
            return (
              <div
                ref={(el) => (cardRefs.current[questionIdxTemp] = el)}
                id={`questionCard-${questionIdxTemp}`}
                key={questionIdxTemp}
                style={{
                  zIndex: 1000 - questionIdxTemp,
                  transform: `${calculateCardTransform(offset)}`,
                  opacity: isHidden ? 0 : (100 - 0 * offset) / 100,
                  height: fullSizeCards ? "100%" : getCardHeight(offset),
                  transitionDuration: "600ms",
                  pointerEvents: offset === 0 ? "auto" : "none",
                  ...borderStyles,
                  ...straightCardArrangementStyles(offset),
                  ...getBottomStyles(),
                }}
                className="pointer rounded-custom bg-survey-bg absolute inset-x-0 backdrop-blur-md transition-all ease-in-out">
                {getCardContent(questionIdxTemp, offset)}
              </div>
            );
          }
        )
      )}
    </div>
  );
};
