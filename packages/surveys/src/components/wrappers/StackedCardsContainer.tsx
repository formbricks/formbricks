import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { TProductStyling } from "@formbricks/types/product";
import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";

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
  const [cardWidth, setCardWidth] = useState<number>(0);

  const questionIdxTemp = useMemo(() => {
    if (currentQuestionId === "start") return survey.welcomeCard.enabled ? -1 : 0;
    if (!survey.questions.map((question) => question.id).includes(currentQuestionId)) {
      return survey.questions.length;
    }
    return survey.questions.findIndex((question) => question.id === currentQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionId, survey.welcomeCard.enabled, survey.questions.length]);

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
    const rotationCoefficient = cardWidth >= 1000 ? 1.5 : cardWidth > 650 ? 2 : 3;
    return (offset: number) => {
      switch (cardArrangement) {
        case "casual":
          return offset < 0
            ? `translateX(33%)`
            : `translateX(0) rotate(-${(hovered ? rotationCoefficient : rotationCoefficient - 0.5) * offset}deg)`;
        case "straight":
          return offset < 0 ? `translateY(25%)` : `translateY(-${(hovered ? 12 : 10) * offset}px)`;
        default:
          return offset < 0 ? `translateX(0)` : `translateX(0)`;
      }
    };
  }, [cardArrangement, hovered, cardWidth]);

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
    const timer = setTimeout(() => {
      const currentElement = cardRefs.current[questionIdxTemp];
      if (currentElement) {
        if (resizeObserver.current) {
          resizeObserver.current.disconnect();
        }
        resizeObserver.current = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setCardHeight(entry.contentRect.height + "px");
            setCardWidth(entry.contentRect.width);
          }
        });
        resizeObserver.current.observe(currentElement);
      }
    }, 0);
    return () => {
      resizeObserver.current?.disconnect();
      clearTimeout(timer);
    };
  }, [questionIdxTemp, cardArrangement, cardRefs]);

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
      className="fb-relative fb-flex fb-h-full fb-items-end fb-justify-center md:fb-items-center"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}>
      <div style={{ height: cardHeight }}></div>
      {cardArrangement === "simple" ? (
        <div
          id={`questionCard-${questionIdxTemp}`}
          className={cn("fb-w-full", fullSizeCards ? "fb-h-full" : "")}
          style={{
            ...borderStyles,
          }}>
          {getCardContent(questionIdxTemp, 0)}
        </div>
      ) : (
        questionIdxTemp !== undefined &&
        [prevQuestionIdx, currentQuestionIdx, nextQuestionIdx, nextQuestionIdx + 1].map(
          (questionIdxTemp, index) => {
            const hasEndingCard = survey.endings.length > 0;
            // Check for hiding extra card
            if (questionIdxTemp > survey.questions.length + (hasEndingCard ? 0 : -1)) return;
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
                className="fb-pointer fb-rounded-custom fb-bg-survey-bg fb-absolute fb-inset-x-0 fb-backdrop-blur-md fb-transition-all fb-ease-in-out">
                {getCardContent(questionIdxTemp, offset)}
              </div>
            );
          }
        )
      )}
    </div>
  );
};
