"use client";

import { structuredClone } from "@/lib/pollyfills/structuredClone";
import {
  extractId,
  extractRecallInfo,
  findRecallInfoById,
  getFallbackValues,
  getRecallItems,
  headlineToRecall,
  recallToHeadline,
  replaceRecallInfoWithUnderline,
} from "@/lib/utils/recall";
import { FallbackInput } from "@/modules/survey/components/question-form-input/components/fallback-input";
import { RecallItemSelect } from "@/modules/survey/components/question-form-input/components/recall-item-select";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { PencilIcon } from "lucide-react";
import React, { JSX, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";

interface RecallWrapperRenderProps {
  value: string;
  onChange: (val: string) => void;
  highlightedJSX: JSX.Element[];
  children: ReactNode;
  isRecallSelectVisible: boolean;
}

interface RecallWrapperProps {
  value: string | undefined;
  onChange: (val: string, recallItems: TSurveyRecallItem[], fallbacks: { [id: string]: string }) => void;
  localSurvey: TSurvey;
  questionId: string;
  render: (props: RecallWrapperRenderProps) => React.ReactNode;
  usedLanguageCode: string;
  isRecallAllowed: boolean;
  onAddFallback: (fallback: string) => void;
}

export const RecallWrapper = ({
  value,
  onChange,
  localSurvey,
  questionId,
  render,
  usedLanguageCode,
  isRecallAllowed,
  onAddFallback,
}: RecallWrapperProps) => {
  const { t } = useTranslate();
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [recallItems, setRecallItems] = useState<TSurveyRecallItem[]>(
    value?.includes("#recall:") ? getRecallItems(value, localSurvey, usedLanguageCode) : []
  );
  const [fallbacks, setFallbacks] = useState<{ [id: string]: string }>(
    value?.includes("/fallback:") ? getFallbackValues(value) : {}
  );

  const [internalValue, setInternalValue] = useState<string>(headlineToRecall(value, recallItems, fallbacks));
  const [renderedText, setRenderedText] = useState<JSX.Element[]>([]);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const hasRecallItems = useMemo(() => {
    return recallItems.length > 0 || value?.includes("recall:");
  }, [recallItems.length, value]);

  useEffect(() => {
    setInternalValue(headlineToRecall(value, recallItems, fallbacks));
  }, [value, recallItems, fallbacks]);

  const checkForRecallSymbol = useCallback((str: string) => {
    // Get cursor position by finding last character
    // Only trigger when @ is the last character typed
    const lastChar = str[str.length - 1];
    const shouldShow = lastChar === "@";
    setShowRecallItemSelect(shouldShow);
  }, []);

  const handleInputChange = useCallback(
    (newVal: string) => {
      const updatedText = {
        [usedLanguageCode]: newVal,
      };

      const val = recallToHeadline(updatedText, localSurvey, false, usedLanguageCode)[usedLanguageCode];

      setInternalValue(newVal);

      if (isRecallAllowed) {
        checkForRecallSymbol(val);
      }

      onChange(newVal, recallItems, fallbacks);
    },
    [checkForRecallSymbol, isRecallAllowed, localSurvey, onChange, recallItems, fallbacks, usedLanguageCode]
  );

  const addRecallItem = useCallback(
    (recallItem: TSurveyRecallItem) => {
      if (recallItem.label.trim() === "") {
        toast.error("Recall item label cannot be empty");
        return;
      }

      let recallItemTemp = structuredClone(recallItem);
      recallItemTemp.label = replaceRecallInfoWithUnderline(recallItem.label);

      const updatedRecallItems = [...recallItems, recallItemTemp];

      setRecallItems(updatedRecallItems);

      if (!Object.keys(fallbacks).includes(recallItem.id)) {
        setFallbacks((prevFallbacks) => ({
          ...prevFallbacks,
          [recallItem.id]: "",
        }));
      }

      setShowRecallItemSelect(false);

      let modifiedHeadlineWithId = { [usedLanguageCode]: internalValue };
      modifiedHeadlineWithId[usedLanguageCode] = modifiedHeadlineWithId[usedLanguageCode].replace(
        /@(\b|$)/g,
        `#recall:${recallItem.id}/fallback:# `
      );

      onChange(modifiedHeadlineWithId[usedLanguageCode], updatedRecallItems, fallbacks);
      setInternalValue(modifiedHeadlineWithId[usedLanguageCode]);
      setShowFallbackInput(true);
    },
    [fallbacks, usedLanguageCode, internalValue, onChange, recallItems]
  );

  const addFallback = useCallback(() => {
    let newVal = internalValue;
    recallItems.forEach((item) => {
      const recallInfo = findRecallInfoById(newVal, item.id);
      if (recallInfo) {
        const fallbackValue = (fallbacks[item.id]?.trim() || "").replace(/ /g, "nbsp");
        let updatedFallbacks = { ...fallbacks };
        updatedFallbacks[item.id] = fallbackValue;
        setFallbacks(updatedFallbacks);
        newVal = newVal.replace(recallInfo, `#recall:${item.id}/fallback:${fallbackValue}#`);

        onChange(newVal, recallItems, updatedFallbacks);
      }
    });

    setShowFallbackInput(false);
    setShowRecallItemSelect(false);
    onAddFallback(newVal);
  }, [fallbacks, recallItems, internalValue, onChange, onAddFallback]);

  const filterRecallItems = useCallback(
    (remainingText: string) => {
      let includedRecallItems: TSurveyRecallItem[] = [];

      recallItems.forEach((recallItem) => {
        if (remainingText.includes(`@${recallItem.label}`)) {
          includedRecallItems.push(recallItem);
        } else {
          const recallItemToRemove = recallItem.label.slice(0, -1);
          const newInternalValue = internalValue.replace(`@${recallItemToRemove}`, "");

          setInternalValue(newInternalValue);
          onChange(newInternalValue, recallItems, fallbacks);

          let updatedFallback = { ...fallbacks };
          delete updatedFallback[recallItem.id];
          setFallbacks(updatedFallback);
          setRecallItems(includedRecallItems);
        }
      });
    },
    [fallbacks, internalValue, onChange, recallItems, setInternalValue]
  );

  useEffect(() => {
    if (showFallbackInput && fallbackInputRef.current) {
      fallbackInputRef.current.focus();
    }
  }, [showFallbackInput]);

  useEffect(() => {
    const recallItemLabels = recallItems.flatMap((recallItem) => {
      if (!recallItem.label.includes("#recall:")) {
        return [recallItem.label];
      }
      const info = extractRecallInfo(recallItem.label);
      if (info) {
        const recallItemId = extractId(info);
        const recallQuestion = localSurvey.questions.find((q) => q.id === recallItemId);
        if (recallQuestion) {
          // replace nested recall with "___"
          return [recallItem.label.replace(info, "___")];
        }
      }
      return [];
    });

    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText = recallToHeadline(
        { [usedLanguageCode]: internalValue },
        localSurvey,
        false,
        usedLanguageCode
      )[usedLanguageCode];

      filterRecallItems(remainingText);

      recallItemLabels.forEach((label) => {
        const index = remainingText.indexOf("@" + label);
        if (index !== -1) {
          if (index > 0) {
            parts.push(
              <span key={`text-${parts.length}`} className="whitespace-pre">
                {remainingText.substring(0, index)}
              </span>
            );
          }
          parts.push(
            <span
              className="z-30 flex h-fit cursor-pointer justify-center whitespace-pre rounded-md bg-slate-100 text-sm text-transparent"
              key={`recall-${parts.length}`}>
              {"@" + label}
            </span>
          );
          remainingText = remainingText.substring(index + label.length + 1);
        }
      });
      if (remainingText?.length) {
        parts.push(
          <span className="whitespace-pre" key={`remaining-${parts.length}`}>
            {remainingText}
          </span>
        );
      }
      return parts;
    };

    setRenderedText(processInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalValue, recallItems]);

  return (
    <div className="relative">
      {render({
        value: internalValue,
        onChange: handleInputChange,
        highlightedJSX: renderedText,
        isRecallSelectVisible: showRecallItemSelect,
        children: (
          <div>
            {hasRecallItems && (
              <Button
                variant="ghost"
                type="button"
                className="absolute right-2 top-full z-[1] flex h-6 cursor-pointer items-center rounded-b-lg rounded-t-none bg-slate-100 px-2.5 py-0 text-xs hover:bg-slate-200"
                onClick={(e) => {
                  e.preventDefault();
                  setShowFallbackInput(!showFallbackInput);
                }}>
                {t("environments.surveys.edit.edit_recall")}
                <PencilIcon className="h-3 w-3" />
              </Button>
            )}

            {showRecallItemSelect && (
              <RecallItemSelect
                localSurvey={localSurvey}
                questionId={questionId}
                addRecallItem={addRecallItem}
                setShowRecallItemSelect={setShowRecallItemSelect}
                recallItems={recallItems}
                selectedLanguageCode={usedLanguageCode}
                hiddenFields={localSurvey.hiddenFields}
              />
            )}

            {showFallbackInput && recallItems.length > 0 && (
              <FallbackInput
                filteredRecallItems={recallItems}
                fallbacks={fallbacks}
                setFallbacks={setFallbacks}
                fallbackInputRef={fallbackInputRef as React.RefObject<HTMLInputElement>}
                addFallback={addFallback}
                open={showFallbackInput}
                setOpen={setShowFallbackInput}
              />
            )}
          </div>
        ),
      })}
    </div>
  );
};
