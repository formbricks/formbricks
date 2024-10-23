"use client";

import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createI18nString, extractLanguageCodes, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { useSyncScroll } from "@formbricks/lib/utils/hooks/useSyncScroll";
import {
  extractId,
  extractRecallInfo,
  getFallbackValues,
  getRecallItems,
  headlineToRecall,
  recallToHeadline,
} from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionChoice,
  TSurveyRecallItem,
} from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import {
  getChoiceValue,
  getIndex,
  getPlaceHolderById,
  isValueIncomplete,
} from "@formbricks/ui/components/QuestionFormInput/utils";

interface CustomValueInputProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  questionIdx: number;
  updateValue?: (choiceIdx: number, data: Partial<TSurveyQuestionChoice>) => void;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  label: string;
  maxLength?: number;
  placeholder?: string;
  ref?: RefObject<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  className?: string;
  attributeClasses: TAttributeClass[];
}

export const CustomValueInput = ({
  id,
  value,
  localSurvey,
  questionIdx,
  updateValue,
  isInvalid,
  label,
  selectedLanguageCode,
  maxLength,
  placeholder,
  onBlur,
  className,
  attributeClasses,
}: CustomValueInputProps) => {
  const defaultLanguageCode =
    localSurvey.languages.filter((lang) => lang.default)[0]?.language.code ?? "default";
  const usedLanguageCode = selectedLanguageCode === defaultLanguageCode ? "default" : selectedLanguageCode;
  const question: TSurveyQuestion = localSurvey.questions[questionIdx];
  const isChoice = id.includes("choice");
  const index = getIndex(id, isChoice);

  const questionId = useMemo(() => {
    return question.id;
  }, [question?.id]);

  const surveyLanguageCodes = useMemo(
    () => extractLanguageCodes(localSurvey.languages),
    [localSurvey.languages]
  );
  const isTranslationIncomplete = useMemo(
    () => isValueIncomplete(id, isInvalid, surveyLanguageCodes, value),
    [value, id, isInvalid, surveyLanguageCodes]
  );

  const getElementTextBasedOnType = (): TI18nString => {
    if (isChoice && typeof index === "number") {
      return getChoiceValue(question, index, surveyLanguageCodes);
    }

    return (
      (question && (question[id as keyof TSurveyQuestion] as TI18nString)) ||
      createI18nString("", surveyLanguageCodes)
    );
  };

  const [text, setText] = useState(getElementTextBasedOnType());
  const [renderedText, setRenderedText] = useState<JSX.Element[]>();
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);
  const [recallItems, setRecallItems] = useState<TSurveyRecallItem[]>(
    getLocalizedValue(text, usedLanguageCode).includes("#recall:")
      ? getRecallItems(
          getLocalizedValue(text, usedLanguageCode),
          localSurvey,
          usedLanguageCode,
          attributeClasses
        )
      : []
  );
  const [fallbacks, setFallbacks] = useState<{ [type: string]: string }>(
    getLocalizedValue(text, usedLanguageCode).includes("/fallback:")
      ? getFallbackValues(getLocalizedValue(text, usedLanguageCode))
      : {}
  );

  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hook to synchronize the horizontal scroll position of highlightContainerRef and inputRef.
  useSyncScroll(highlightContainerRef, inputRef);

  useEffect(() => {
    setRecallItems(
      getLocalizedValue(text, usedLanguageCode).includes("#recall:")
        ? getRecallItems(
            getLocalizedValue(text, usedLanguageCode),
            localSurvey,
            usedLanguageCode,
            attributeClasses
          )
        : []
    );
  }, [usedLanguageCode]);

  useEffect(() => {
    if (id === "headline" || id === "subheader") {
      checkForRecallSymbol();
    }
    // Generates an array of headlines from recallItems, replacing nested recall questions with '___' .
    const recallItemLabels = recallItems.flatMap((recallItem) => {
      if (!recallItem.label.includes("#recall:")) {
        return [recallItem.label];
      }
      const recallItemLabel = recallItem.label;
      const recallInfo = extractRecallInfo(recallItemLabel);

      if (recallInfo) {
        const recallItemId = extractId(recallInfo);
        const recallQuestion = localSurvey.questions.find((question) => question.id === recallItemId);

        if (recallQuestion) {
          return [recallItemLabel.replace(recallInfo, `___`)];
        }
      }
      return [];
    });

    // Constructs an array of JSX elements representing segmented parts of text, interspersed with special formatted spans for recall headlines.
    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText = recallToHeadline(text, localSurvey, false, usedLanguageCode, attributeClasses)[
        usedLanguageCode
      ];
      filterRecallItems(remainingText);
      recallItemLabels.forEach((label) => {
        const index = remainingText.indexOf("@" + label);
        if (index !== -1) {
          if (index > 0) {
            parts.push(
              <span key={parts.length} className="whitespace-pre">
                {remainingText.substring(0, index)}
              </span>
            );
          }
          parts.push(
            <span
              className="z-30 flex h-fit cursor-pointer justify-center whitespace-pre rounded-md bg-slate-100 text-sm text-transparent"
              key={parts.length}>
              {"@" + label}
            </span>
          );
          remainingText = remainingText.substring(index + label.length + 1);
        }
      });
      if (remainingText?.length) {
        parts.push(
          <span className="whitespace-pre" key={parts.length}>
            {remainingText}
          </span>
        );
      }
      return parts;
    };
    setRenderedText(processInput());
  }, [text, recallItems]);

  useEffect(() => {
    setText(getElementTextBasedOnType());
  }, [localSurvey]);

  const checkForRecallSymbol = () => {
    const pattern = /(^|\s)@(\s|$)/;
    if (pattern.test(getLocalizedValue(text, usedLanguageCode))) {
      setShowRecallItemSelect(true);
    } else {
      setShowRecallItemSelect(false);
    }
  };

  const filterRecallItems = (remainingText: string) => {
    let includedRecallItems: TSurveyRecallItem[] = [];
    recallItems.forEach((recallItem) => {
      if (remainingText.includes(`@${recallItem.label}`)) {
        includedRecallItems.push(recallItem);
      } else {
        const recallItemToRemove = recallItem.label.slice(0, -1);
        const newText = { ...text };
        newText[usedLanguageCode] = text[usedLanguageCode].replace(`@${recallItemToRemove}`, "");
        setText(newText);
        handleUpdate(text[usedLanguageCode].replace(`@${recallItemToRemove}`, ""));
        let updatedFallback = { ...fallbacks };
        delete updatedFallback[recallItem.id];
        setFallbacks(updatedFallback);
        setRecallItems(includedRecallItems);
      }
    });
  };

  const handleUpdate = (updatedText: string) => {
    const createUpdatedText = (updatedText: string): TI18nString => {
      return {
        ...getElementTextBasedOnType(),
        [usedLanguageCode]: updatedText,
      };
    };
    const updateChoiceDetails = (translatedText: TI18nString) => {
      if (updateValue && typeof index === "number") {
        updateValue(index, { value: translatedText });
      }
    };
    const translatedText = createUpdatedText(updatedText);

    if (isChoice) {
      updateChoiceDetails(translatedText);
    }
  };

  return (
    <div className="w-full">
      <div className="w-full">
        <div className="mb-2 mt-3">
          <Label htmlFor={id}>{label}</Label>
        </div>

        <div className="flex flex-col gap-4 bg-white">
          <div className="flex items-center space-x-2">
            <div className="group relative w-full">
              <div className="h-10 w-full"></div>
              <div
                id="wrapper"
                ref={highlightContainerRef}
                className={`no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent ${localSurvey.languages?.length > 1 ? "pr-24" : ""}`}
                dir="auto">
                {renderedText}
              </div>
              <Input
                key={`${questionId}-${id}-${usedLanguageCode}`}
                dir="auto"
                className={`absolute top-0 text-black caret-black ${localSurvey.languages?.length > 1 ? "pr-24" : ""} ${className}`}
                placeholder={placeholder ? placeholder : getPlaceHolderById(id)}
                id={id}
                name={id}
                aria-label={label}
                autoComplete={showRecallItemSelect ? "off" : "on"}
                value={
                  recallToHeadline(text, localSurvey, false, usedLanguageCode, attributeClasses)[
                    usedLanguageCode
                  ]
                }
                ref={inputRef}
                onBlur={onBlur}
                onChange={(e) => {
                  let translatedText = {
                    ...getElementTextBasedOnType(),
                    [usedLanguageCode]: e.target.value,
                  };
                  setText(
                    recallToHeadline(translatedText, localSurvey, false, usedLanguageCode, attributeClasses)
                  );
                  handleUpdate(headlineToRecall(e.target.value, recallItems, fallbacks));
                }}
                maxLength={maxLength ?? undefined}
                isInvalid={
                  isInvalid &&
                  text[usedLanguageCode]?.trim() === "" &&
                  localSurvey.languages?.length > 1 &&
                  isTranslationIncomplete
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
