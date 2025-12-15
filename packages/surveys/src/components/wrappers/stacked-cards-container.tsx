import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "react";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TProjectStyling } from "@formbricks/types/project";
import { type TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/utils";
import { StackedCard } from "./stacked-card";

// offset = 0 -> Current block card
// offset < 0 -> Block cards that are already answered
// offset > 0 -> Blocks that aren't answered yet
interface StackedCardsContainerProps {
  cardArrangement: TCardArrangementOptions;
  currentBlockId: string;
  survey: TJsEnvironmentStateSurvey;
  getCardContent: (blockIdx: number, offset: number) => JSX.Element | undefined;
  styling: TProjectStyling | TSurveyStyling;
  setBlockId: (blockId: string) => void;
  shouldResetBlockId?: boolean;
  fullSizeCards: boolean;
}

export function StackedCardsContainer({
  cardArrangement,
  currentBlockId,
  survey,
  getCardContent,
  styling,
  setBlockId,
  shouldResetBlockId = true,
  fullSizeCards = false,
}: Readonly<StackedCardsContainerProps>) {
  const [hovered, setHovered] = useState(false);
  const highlightBorderColor = survey.styling?.overwriteThemeStyling
    ? survey.styling?.highlightBorderColor?.light
    : styling.highlightBorderColor?.light;
  const cardBorderColor = survey.styling?.overwriteThemeStyling
    ? survey.styling?.cardBorderColor?.light
    : styling.cardBorderColor?.light;
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [cardHeight, setCardHeight] = useState("auto");
  const [cardWidth, setCardWidth] = useState<number>(0);

  const blockIdxTemp = useMemo(() => {
    if (currentBlockId === "start") return survey.welcomeCard.enabled ? -1 : 0;

    if (!survey.blocks.map((block) => block.id).includes(currentBlockId)) {
      return survey.blocks.length;
    }

    return survey.blocks.findIndex((block) => block.id === currentBlockId);
  }, [currentBlockId, survey]);

  const [prevBlockIdx, setPrevBlockIdx] = useState(blockIdxTemp - 1);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(blockIdxTemp);
  const [nextBlockIdx, setNextBlockIdx] = useState(blockIdxTemp + 1);
  const [visitedBlocks, setVisitedBlocks] = useState<number[]>([]);

  useEffect(() => {
    if (blockIdxTemp > currentBlockIdx) {
      // Next button is clicked
      setPrevBlockIdx(currentBlockIdx);
      setCurrentBlockIdx(blockIdxTemp);
      setNextBlockIdx(blockIdxTemp + 1);
      setVisitedBlocks((prev) => {
        return [...prev, currentBlockIdx];
      });
    } else if (blockIdxTemp < currentBlockIdx) {
      // Back button is clicked
      setNextBlockIdx(currentBlockIdx);
      setCurrentBlockIdx(blockIdxTemp);

      // Compute new visited stack and safe previous index
      const newStack = visitedBlocks.length > 0 ? visitedBlocks.slice(0, -1) : [];
      const safePrevIdx = newStack.length > 0 ? newStack[newStack.length - 1] : Math.max(0, blockIdxTemp - 1);

      setPrevBlockIdx(safePrevIdx);
      setVisitedBlocks(newStack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only update when blockIdxTemp changes
  }, [blockIdxTemp]);

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
      borderColor,
    };
  }, [survey.type, cardBorderColor, highlightBorderColor]);

  // UseEffect to handle the resize of current block card and set cardHeight accordingly
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleDebouncedResize = (entries: ResizeObserverEntry[]) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          setCardHeight(`${entry.contentRect.height.toString()}px`);
          setCardWidth(entry.contentRect.width);
        }
      }, 50); // 50ms debounce
    };

    const timer = setTimeout(() => {
      const currentElement = cardRefs.current[blockIdxTemp];
      if (currentElement) {
        if (resizeObserver.current) {
          resizeObserver.current.disconnect();
        }

        resizeObserver.current = new ResizeObserver((entries) => {
          handleDebouncedResize(entries);
        });
        resizeObserver.current.observe(currentElement);
      }
    }, 0);

    return () => {
      resizeObserver.current?.disconnect();
      clearTimeout(timer);
      clearTimeout(resizeTimeout);
    };
  }, [blockIdxTemp, cardArrangement, cardRefs]);

  // Reset block progress, when card arrangement changes
  useEffect(() => {
    if (shouldResetBlockId) {
      setBlockId(survey.welcomeCard.enabled ? "start" : survey.blocks[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only update when cardArrangement changes
  }, [cardArrangement]);

  return (
    <div
      data-testid="stacked-cards-container"
      className="relative flex h-full items-end justify-center md:items-center"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}>
      <div style={{ height: cardHeight }} />
      {cardArrangement === "simple" ? (
        <div
          id={`questionCard-${blockIdxTemp.toString()}`}
          data-testid={`questionCard-${blockIdxTemp.toString()}`}
          className={cn("bg-survey-bg w-full overflow-hidden", fullSizeCards ? "h-full" : "")}
          style={borderStyles}>
          {getCardContent(blockIdxTemp, 0)}
        </div>
      ) : (
        blockIdxTemp !== undefined &&
        [prevBlockIdx, currentBlockIdx, nextBlockIdx, nextBlockIdx + 1].map((dynamicBlockIndex, index) => {
          const hasEndingCard = survey.endings.length > 0;
          // Check for hiding extra card
          if (dynamicBlockIndex > survey.blocks.length + (hasEndingCard ? 0 : -1)) return;
          const offset = index - 1;
          return (
            <StackedCard
              key={dynamicBlockIndex}
              cardRefs={cardRefs}
              dynamicQuestionIndex={dynamicBlockIndex}
              offset={offset}
              fullSizeCards={fullSizeCards}
              borderStyles={borderStyles}
              getCardContent={getCardContent}
              cardHeight={cardHeight}
              survey={survey}
              cardWidth={cardWidth}
              hovered={hovered}
              cardArrangement={cardArrangement}
            />
          );
        })
      )}
    </div>
  );
}
