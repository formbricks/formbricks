"use client";

import { useMemo, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyRedirectUrlCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { md } from "@/lib/markdownIt";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Editor } from "@/modules/ui/components/editor";

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  /** Writes the field of an element; used unless `isCard`. */
  updateElement?: (elementIdx: number, data: Partial<TSurveyElement>) => void;
  /** Writes the field of the welcome or ending card; used when `isCard`. */
  updateCard?: (
    data: Partial<TSurveyEndScreenCard> | Partial<TSurveyRedirectUrlCard> | Partial<TSurveyWelcomeCard>
  ) => void;
  selectedLanguageCode?: string;
  setSelectedLanguageCode?: (languageCode: string) => void;
  elementIdx: number;
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  locale: string;
  elementId: string;
  isCard?: boolean;
  focusOnMount?: boolean;
  isExternalUrlsAllowed?: boolean;
  suppressUpdates?: () => boolean;
}

export function LocalizedEditor({
  id,
  value,
  localSurvey,
  updateElement,
  updateCard,
  selectedLanguageCode = "default",
  elementIdx,
  firstRender,
  setFirstRender,
  elementId,
  isCard,
  isExternalUrlsAllowed,
  suppressUpdates,
  focusOnMount,
}: Readonly<LocalizedEditorProps>) {
  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const [, startTransition] = useTransition();

  return (
    <div className="relative w-full">
      <Editor
        id={id}
        disableLists
        unwrapSingleCellTables
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        focusOnMount={focusOnMount}
        getText={() => {
          const text = value ? (value[selectedLanguageCode] ?? "") : "";
          return md.render(text);
        }}
        key={`${elementId}-${id}-${selectedLanguageCode}`}
        setFirstRender={setFirstRender}
        setText={(v: string) => {
          if (suppressUpdates?.()) {
            return;
          }

          let sanitizedContent = v;
          if (!isExternalUrlsAllowed) {
            sanitizedContent = v.replaceAll(/<a[^>]*>(.*?)<\/a>/gi, "$1");
          }

          const currentElement = elements[elementIdx];

          startTransition(() => {
            if (isCard) {
              const isWelcomeCard = elementIdx === -1;
              const isEndingCard = elementIdx >= elements.length;

              if (isEndingCard) {
                const ending = localSurvey.endings.find((ending) => ending.id === elementId);
                if ((ending as Record<string, unknown>)?.[id] === undefined) {
                  return;
                }
              }

              if (isWelcomeCard && !localSurvey.welcomeCard) {
                return;
              }

              const translatedContent = {
                ...value,
                [selectedLanguageCode]: sanitizedContent,
              };
              updateCard?.({ [id]: translatedContent });
              return;
            }

            if (
              currentElement &&
              id in currentElement &&
              (currentElement as Record<string, unknown>)[id] !== undefined
            ) {
              const translatedContent = {
                ...value,
                [selectedLanguageCode]: sanitizedContent,
              };
              updateElement?.(elementIdx, { [id]: translatedContent });
            }
          });
        }}
        localSurvey={localSurvey}
        elementId={elementId}
        selectedLanguageCode={selectedLanguageCode}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
      />
    </div>
  );
}
