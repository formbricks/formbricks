import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementLock } from "@/modules/survey/editor/lib/published-lock";

/**
 * What the published lock leaves of the translations (ADR 0015). Answers are stored as the option text, so
 * on a survey that has left draft the text of an option in a language it already had cannot change or go;
 * filling an empty translation stays open. The editor-side mirror of `option_text_changed` in
 * `@formbricks/types/surveys/published-lock`, which is what the server enforces on save.
 */

const OPTION_LISTS = ["choices", "rows", "columns"] as const;

/** The path of an option label as `extractTranslatableStrings` writes it: `blocks.0.elements.1.choices.2.label`. */
const OPTION_LABEL_PATH = /^blocks\.(\d+)\.elements\.(\d+)\.(choices|rows|columns)\.(\d+)\.label$/;

/** Whether the translatable string at `path` is an option text that already has this language when stored. */
export const isTranslationPathLocked = (
  localSurvey: TSurvey,
  persistedSurvey: TSurvey,
  path: string,
  languageCode: string
): boolean => {
  const match = OPTION_LABEL_PATH.exec(path);
  if (!match) return false;

  const [, blockIndex, elementIndex, list, optionIndex] = match;
  const element = localSurvey.blocks[Number(blockIndex)]?.elements[Number(elementIndex)];
  const option = (element as unknown as Record<string, { id: string }[] | undefined> | undefined)?.[list][
    Number(optionIndex)
  ];
  if (!element || !option) return false;

  return getElementLock(persistedSurvey, element.id).isOptionTextLocked(
    list as (typeof OPTION_LISTS)[number],
    option.id,
    languageCode
  );
};

/**
 * Whether the stored survey holds locked option text in `languageCode`, or in any language but the default
 * when none is given. Removing the language, or changing the default (which removes every translation),
 * would drop that text, so the save would be refused.
 */
export const hasLockedTranslations = (persistedSurvey: TSurvey, languageCode?: string): boolean => {
  if (persistedSurvey.status === "draft") return false;

  return persistedSurvey.blocks.some((block) =>
    block.elements.some((element) =>
      OPTION_LISTS.some((list) =>
        (
          (element as unknown as Record<string, { label?: Record<string, unknown> }[] | undefined>)[list] ??
          []
        ).some((option) =>
          Object.entries(option.label ?? {}).some(
            ([code, text]) =>
              code !== "default" &&
              (languageCode === undefined || code === languageCode) &&
              typeof text === "string" &&
              text.trim() !== ""
          )
        )
      )
    )
  );
};
