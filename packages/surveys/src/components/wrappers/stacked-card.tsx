import { useEffect, useMemo, useState } from "react";
import { JSX } from "react";
import React, { RefObject } from "react";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TCardArrangementOptions } from "@formbricks/types/styling";

interface StackedCardProps {
  cardRefs: RefObject<(HTMLDivElement | null)[]>;
  dynamicQuestionIndex: number;
  offset: number;
  fullSizeCards: boolean;
  borderStyles: React.CSSProperties;
  getCardContent: (questionIdxTemp: number, offset: number) => JSX.Element | undefined;
  cardHeight: string;
  survey: TJsEnvironmentStateSurvey;
  cardWidth: number;
  hovered: boolean;
  cardArrangement: TCardArrangementOptions;
}

export const StackedCard = ({
  cardRefs,
  dynamicQuestionIndex,
  offset,
  fullSizeCards,
  borderStyles,
  getCardContent,
  cardHeight,
  survey,
  cardWidth,
  hovered,
  cardArrangement,
}: StackedCardProps) => {
  const isHidden = offset < 0;
  const [delayedOffset, setDelayedOffset] = useState<number>(offset);
  const [contentOpacity, setContentOpacity] = useState<number>(0);
  const currentCardHeight = offset === 0 ? "auto" : offset < 0 ? "initial" : cardHeight;

  const getBottomStyles = () => {
    if (survey.type !== "link")
      return {
        bottom: 0,
      };
  };

  const getDummyCardContent = () => {
    return <div style={{ height: cardHeight }} className="w-full p-6"></div>;
  };

  const calculateCardTransform = useMemo(() => {
    let rotationCoefficient = 3;

    if (cardWidth >= 1000) {
      rotationCoefficient = 1.5;
    } else if (cardWidth > 650) {
      rotationCoefficient = 2;
    }

    return (offset: number) => {
      switch (cardArrangement) {
        case "casual":
          return offset < 0
            ? `translateX(33%)`
            : `translateX(0) rotate(-${((hovered ? rotationCoefficient : rotationCoefficient - 0.5) * offset).toString()}deg)`;
        case "straight":
          return offset < 0
            ? `translateY(25%)`
            : `translateY(-${((hovered ? 12 : 10) * offset).toString()}px)`;
        default:
          return offset < 0 ? `translateX(0)` : `translateX(0)`;
      }
    };
  }, [cardArrangement, hovered, cardWidth]);

  const straightCardArrangementStyles =
    cardArrangement === "straight"
      ? {
          width: `${(100 - 5 * offset >= 100 ? 100 : 100 - 5 * offset).toString()}%`,
          margin: "auto",
        }
      : {};

  useEffect(() => {
    setTimeout(() => {
      setDelayedOffset(offset);
    }, 300);

    if (offset === 0) {
      setContentOpacity(0);
      setTimeout(() => {
        setContentOpacity(1);
      }, 300);
    }
  }, [offset]);

  return (
    <div
      ref={(el) => (cardRefs.current[dynamicQuestionIndex] = el)}
      id={`questionCard-${dynamicQuestionIndex}`}
      key={dynamicQuestionIndex}
      style={{
        zIndex: 1000 - dynamicQuestionIndex,
        transform: calculateCardTransform(offset),
        opacity: isHidden ? 0 : (100 - 20 * offset) / 100,
        height: fullSizeCards ? "100%" : currentCardHeight,
        transitionDuration: "600ms",
        pointerEvents: offset === 0 ? "auto" : "none",
        ...borderStyles,
        ...straightCardArrangementStyles,
        ...getBottomStyles(),
      }}
      className="pointer rounded-custom bg-survey-bg absolute inset-x-0 overflow-hidden backdrop-blur-md transition-all ease-in-out">
      <div
        style={{
          opacity: contentOpacity,
          transition: "opacity 300ms ease-in-out",
          height: "100%",
        }}>
        {delayedOffset === 0 ? getCardContent(dynamicQuestionIndex, offset) : getDummyCardContent()}
      </div>
    </div>
  );
};
