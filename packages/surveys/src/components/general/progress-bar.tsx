import { useCallback, useMemo } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { Progress } from "@/components/general/progress";

interface ProgressBarProps {
  survey: TJsEnvironmentStateSurvey;
  blockId: string;
}

export function ProgressBar({ survey, blockId }: ProgressBarProps) {
  const currentBlockIdx = useMemo(
    () => survey.blocks.findIndex((b) => b.id === blockId),
    [survey.blocks, blockId]
  );

  const endingCardIds = useMemo(() => survey.endings.map((ending) => ending.id), [survey.endings]);

  const calculateProgress = useCallback(
    (blockIndex: number) => {
      let totalCards = survey.blocks.length;
      if (endingCardIds.length > 0) totalCards += 1;

      if (blockIndex === -1) return 0; // Welcome card

      // Progress is simply block position / total blocks
      return (blockIndex + 1) / totalCards;
    },
    [survey.blocks.length, endingCardIds.length]
  );

  const progressValue = useMemo(() => {
    if (blockId === "start") {
      return 0;
    } else if (endingCardIds.includes(blockId)) {
      return 1;
    }
    return calculateProgress(currentBlockIdx);
  }, [blockId, endingCardIds, calculateProgress, currentBlockIdx]);

  return <Progress progress={progressValue} />;
}
