import { MutableRef } from "preact/hooks";
import { useLayoutEffect, useMemo, useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import React from "react";
import { FB_PART } from "@formbricks/survey-ui/parts";
import { type TPlacement } from "@formbricks/types/common";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TCardArrangementOptions } from "@formbricks/types/styling";

interface StackedCardProps {
  cardElementsRef: MutableRef<(HTMLDivElement | null)[]>;
  dynamicQuestionIndex: number;
  offset: number;
  fullSizeCards: boolean;
  borderStyles: React.CSSProperties;
  getCardContent: (questionIdxTemp: number, offset: number) => JSX.Element | undefined;
  cardHeight: string;
  survey: TJsWorkspaceStateSurvey;
  cardWidth: number;
  hovered: boolean;
  cardArrangement: TCardArrangementOptions;
  placement: TPlacement;
}

export const StackedCard = ({
  cardElementsRef,
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
  placement,
}: StackedCardProps) => {
  const isHidden = offset < 0;
  const [delayedOffset, setDelayedOffset] = useState<number>(offset);
  const [contentOpacity, setContentOpacity] = useState<number>(0);
  let currentCardHeight = cardHeight;
  if (offset === 0) currentCardHeight = "auto";
  else if (offset < 0) currentCardHeight = "initial";

  const getTopBottomStyles = () => {
    if (survey.type !== "link")
      if (placement === "bottomLeft" || placement === "bottomRight") {
        return {
          bottom: 0,
        };
      } else if (placement === "topLeft" || placement === "topRight") {
        return {
          top: 0,
        };
      }
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
        case "casual": {
          if (offset < 0) return `translateX(33%)`;
          const coefficient = hovered ? rotationCoefficient : rotationCoefficient - 0.5;
          return `translateX(0) rotate(-${(coefficient * offset).toString()}deg)`;
        }
        case "straight": {
          if (offset < 0) return `translateY(25%)`;
          const step = hovered ? 12 : 10;
          return `translateY(-${(step * offset).toString()}px)`;
        }
        default:
          return `translateX(0)`;
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

  // Both timers are cancelled when the offset changes again: a Next followed quickly by a Back left the
  // first move's swap pending, and it then put the old card's content back under the respondent.
  // A layout effect, so the previous offset's timers are cleared in the same commit as the new offset:
  // Preact runs a passive effect's cleanup only after the next frame, and a timer firing in between
  // would show the stale offset's content on the card the respondent is on.
  useLayoutEffect(() => {
    const swapTimer = setTimeout(() => {
      setDelayedOffset(offset);
    }, 300);

    let fadeInTimer: ReturnType<typeof setTimeout> | undefined;
    if (offset === 0) {
      setContentOpacity(0);
      fadeInTimer = setTimeout(() => {
        setContentOpacity(1);
      }, 300);
    }

    return () => {
      clearTimeout(swapTimer);
      clearTimeout(fadeInTimer);
    };
  }, [offset]);

  return (
    <div
      ref={(el) => {
        cardElementsRef.current[dynamicQuestionIndex] = el;
      }}
      id={`questionCard-${dynamicQuestionIndex}`}
      data-testid={`questionCard-${dynamicQuestionIndex}`}
      // Public styling hook (ENG-3554): the visible card surface.
      data-fb-part={FB_PART.card}
      key={dynamicQuestionIndex}
      style={{
        zIndex: 1000 - dynamicQuestionIndex,
        transform: calculateCardTransform(offset),
        opacity: isHidden ? 0 : (100 - 20 * offset) / 100,
        height: fullSizeCards ? "100%" : currentCardHeight,
        transition: "transform 600ms ease-in-out, opacity 600ms ease-in-out, width 600ms ease-in-out",
        pointerEvents: offset === 0 ? "auto" : "none",
        ...borderStyles,
        ...straightCardArrangementStyles,
        ...getTopBottomStyles(),
      }}
      className="pointer rounded-custom bg-survey-bg absolute inset-x-0 overflow-hidden">
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
