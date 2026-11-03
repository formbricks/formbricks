import {
  type TCopyOptionsSettings,
  canCopyOptionsBetween,
  copyOptionsFrom,
  getCopiedOptionIds,
} from "@formbricks/types/surveys/copied-options";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * "Options copied from" on the Flow tab (ENG-6938): which questions a question may copy its options
 * from, and how linking, "Copy again" and unlinking are written back. Pure, so the popover only renders
 * what these return. The copying itself lives in `@formbricks/types/surveys/copied-options`.
 */

/** The question that copies, by position (the Flow tab's popovers address questions this way). */
export type TCopyTarget = { blockIdx: number; elementIdx: number };

type TRecord = Record<string, unknown>;

const getTarget = (survey: TSurvey, target: TCopyTarget): TSurveyElement | undefined =>
  survey.blocks[target.blockIdx]?.elements[target.elementIdx];

const findElement = (survey: TSurvey, id: unknown): TSurveyElement | undefined =>
  typeof id === "string"
    ? survey.blocks.flatMap((block) => block.elements).find((element) => element.id === id)
    : undefined;

const copiedFromOf = (element: TSurveyElement | undefined): string | undefined => {
  const value = (element as unknown as TRecord | undefined)?.optionsCopiedFrom;
  return typeof value === "string" ? value : undefined;
};

/**
 * The questions the target may copy its options from: those above it (earlier blocks, and above it on
 * its page) with options of the same kind, choices from choices and pictures from pictures.
 */
export const getCopySourceCandidates = (survey: TSurvey, target: TCopyTarget): TSurveyElement[] => {
  const element = getTarget(survey, target);
  if (!element) return [];
  const above = [
    ...survey.blocks.slice(0, target.blockIdx).flatMap((block) => block.elements),
    ...(survey.blocks[target.blockIdx]?.elements.slice(0, target.elementIdx) ?? []),
  ];
  return above.filter((candidate) => canCopyOptionsBetween(candidate.type, element.type));
};

const withTarget = (
  survey: TSurvey,
  target: TCopyTarget,
  update: (element: TSurveyElement) => TSurveyElement
): TSurvey => ({
  ...survey,
  blocks: survey.blocks.map((block, blockIdx) =>
    blockIdx === target.blockIdx
      ? {
          ...block,
          elements: block.elements.map((element, elementIdx) =>
            elementIdx === target.elementIdx ? update(element) : element
          ),
        }
      : block
  ),
});

/**
 * Links the target to `sourceId` and copies its options (a first copy, or a switch to another source,
 * replaces the target's own options; see `copyOptionsFrom`). Copying from the current source again is
 * "Copy again".
 */
export const linkCopiedOptions = (
  survey: TSurvey,
  target: TCopyTarget,
  sourceId: string,
  settings: TCopyOptionsSettings
): TSurvey => {
  const source = findElement(survey, sourceId);
  if (!source) return survey;
  return withTarget(
    survey,
    target,
    (element) =>
      ({
        ...element,
        optionsCopiedFrom: sourceId,
        choices: copyOptionsFrom(source, element, settings),
      }) as TSurveyElement
  );
};

/** "Copy again": brings in the options the source gained since, keeping ids and codes. */
export const copyOptionsAgain = (
  survey: TSurvey,
  target: TCopyTarget,
  settings: TCopyOptionsSettings
): TSurvey => {
  const sourceId = copiedFromOf(getTarget(survey, target));
  return sourceId ? linkCopiedOptions(survey, target, sourceId, settings) : survey;
};

/**
 * Drops the link. The options stay, with their show-if, as the target's own: a link removed by mistake
 * is restored by picking the source again, which changes nothing else.
 */
export const unlinkCopiedOptions = (survey: TSurvey, target: TCopyTarget): TSurvey =>
  withTarget(survey, target, (element) => {
    const { optionsCopiedFrom: _removed, ...rest } = element as unknown as TRecord;
    return rest as unknown as TSurveyElement;
  });

/** How many of the source's options "Copy again" would bring in: those the target doesn't have yet. */
export const countOptionsToCopyAgain = (survey: TSurvey, target: TCopyTarget): number => {
  const element = getTarget(survey, target);
  const source = findElement(survey, copiedFromOf(element));
  if (!element || !source) return 0;
  const copied = getCopiedOptionIds(source, element);
  const copyable = getCopiedOptionIds(source, source);
  return [...copyable].filter((id) => !copied.has(id)).length;
};

/**
 * For the Recode section: the question `element` copies its options from, and which of its options
 * are copies, whose codes are the source's and read-only here. `null` when it copies nothing.
 */
export const getCopiedOptionsSource = (
  survey: TSurvey,
  element: TSurveyElement
): { source: TSurveyElement; copiedIds: Set<string> } | null => {
  const source = findElement(survey, copiedFromOf(element));
  if (!source) return null;
  return { source, copiedIds: getCopiedOptionIds(source, element) };
};
