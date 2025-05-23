import { MutableRef, useEffect, useMemo, useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import React from "react";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TCardArrangementOptions } from "@formbricks/types/styling";

interface StackedCardProps {
  cardRefs: MutableRef<(HTMLDivElement | null)[]>;
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
  const [delayedOffset, setDelayedOffset] = useState<number>(offset);
  const [contentOpacity, setContentOpacity] = useState<number>(0);
  const currentCardHeight = offset === 0 ? "auto" : offset < 0 ? "initial" : cardHeight;
  const isHidden = offset < 0 || offset > 2;

  const getBottomStyles = () => {
    if (survey.type !== "link")
      return {
        bottom: 0,
      };
  };

  const getDummyCardContent = () => {
    return <div style={{ height: cardHeight }} className="fb-w-full fb-p-6"></div>;
  };

  const calculateCardTransform = useMemo(() => {
    if (offset > 2)
      return () => {
        return `opacity(0)`;
      };

    let rotationCoefficient = 3;
    if (cardWidth >= 1000) {
      rotationCoefficient = 1.5;
    } else if (cardWidth > 650) {
      rotationCoefficient = 2;
    }

    let rotationValue = ((hovered ? rotationCoefficient : rotationCoefficient - 0.5) * offset).toString();
    let translateValue = ((hovered ? 12 : 10) * offset).toString();

    return (offset: number) => {
      switch (cardArrangement) {
        case "casual":
          return offset < 0 ? `translateX(35%) scale(0.97)` : `translateX(0) rotate(-${rotationValue}deg)`;
        case "straight":
          return offset < 0 ? `translateY(35%) scale(0.97)` : `translateY(-${translateValue}px)`;
        default:
          return `translateX(0)`;
      }
    };
  }, [cardArrangement, hovered, cardWidth, offset]);

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
      data-testid={`questionCard-${dynamicQuestionIndex}`}
      key={dynamicQuestionIndex}
      style={{
        zIndex: 1000 - dynamicQuestionIndex,
        transform: calculateCardTransform(offset),
        opacity: isHidden ? 0 : (100 - 20 * offset) / 100,
        height: fullSizeCards ? "100%" : currentCardHeight,
        transitionProperty: "transform, opacity, margin, width",
        transitionDuration: "500ms",
        transitionBehavior: "ease-in-out",
        pointerEvents: offset === 0 ? "auto" : "none",
        ...borderStyles,
        ...straightCardArrangementStyles,
        ...getBottomStyles(),
      }}
      className="fb-pointer fb-rounded-custom fb-bg-survey-bg fb-absolute fb-inset-x-0 fb-backdrop-blur-md fb-transition-all fb-ease-in-out fb-overflow-hidden">
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
