"use client";

import { useMemo, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { isValidHTML } from "@formbricks/types/surveys/validation";
import { md } from "@/lib/markdownIt";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Editor } from "@/modules/ui/components/editor";

// Rich-text headlines shipped 2025-10-16 (#6685). Before that, headlines were always plain
// text rendered bold via CSS, so surveys created earlier need their plain-text headline
// wrapped in <strong> here to preserve that look now that headlines are HTML. Surveys created
// on/after this date never depended on CSS-driven bold headlines, so their plain-text
// headlines (e.g. built-in template defaults) must not be force-bolded.
const RICH_TEXT_HEADLINES_LAUNCH_DATE = new Date("2025-10-16T10:52:20Z");

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  updateElement: any;
  selectedLanguageCode?: string;
  setSelectedLanguageCode?: (languageCode: string) => void;
  elementIdx: number;
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  locale: string;
  elementId: string;
  isCard?: boolean;
  autoFocus?: boolean;
  isExternalUrlsAllowed?: boolean;
  suppressUpdates?: () => boolean;
}

export function LocalizedEditor({
  id,
  value,
  localSurvey,
  updateElement,
  selectedLanguageCode = "default",
  elementIdx,
  firstRender,
  setFirstRender,
  elementId,
  isCard,
  isExternalUrlsAllowed,
  suppressUpdates,
  autoFocus,
}: Readonly<LocalizedEditorProps>) {
  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const [, startTransition] = useTransition();

  return (
    <div className="relative w-full">
      <Editor
        id={id}
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        autoFocus={autoFocus}
        getText={() => {
          const text = value ? (value[selectedLanguageCode] ?? "") : "";
          let html = md.render(text);

          if (id === "headline" && text && !isValidHTML(text)) {
            const isLegacySurvey =
              new Date(localSurvey.createdAt).getTime() < RICH_TEXT_HEADLINES_LAUNCH_DATE.getTime();
            if (isLegacySurvey) {
              html = html.replaceAll(/<p>([\s\S]*?)<\/p>/g, "<p><strong>$1</strong></p>");
            }
          }

          return html;
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
              updateElement({ [id]: translatedContent });
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
              updateElement(elementIdx, { [id]: translatedContent });
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
