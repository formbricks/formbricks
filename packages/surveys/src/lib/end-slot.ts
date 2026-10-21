interface TEndSlotInput {
  blockCount: number;
  endingCount: number;
  /** Index of the current card: -1 is the welcome card, `blockCount` is the end slot. */
  blockIdx: number;
  /** Whether the survey is showing a response error card in place of the current card. */
  hasError: boolean;
}

/**
 * The slot after the last block holds the ending card. A survey without one finishes on an end
 * slot with nothing to draw, so the card stack renders it only to show an error that needs a
 * retry (ENG-4069).
 */
export const shouldRenderEndSlot = ({
  blockCount,
  endingCount,
  blockIdx,
  hasError,
}: TEndSlotInput): boolean => endingCount > 0 || (blockIdx >= blockCount && hasError);

/** Whether the card stack draws the card at `slotIdx`: every block, plus the end slot when it has something to show. */
export const isSlotRendered = (slotIdx: number, input: TEndSlotInput): boolean =>
  slotIdx < input.blockCount || (slotIdx === input.blockCount && shouldRenderEndSlot(input));

/** True once a survey without an ending card is finished and has no error to show. */
export const isEndSlotEmpty = (input: TEndSlotInput): boolean =>
  input.blockIdx >= input.blockCount && !shouldRenderEndSlot(input);
