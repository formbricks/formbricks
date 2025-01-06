import { FallbackInput } from "@/modules/surveys/components/QuestionFormInput/components/FallbackInput";
import { RecallItemSelect } from "@/modules/surveys/components/QuestionFormInput/components/RecallItemSelect";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import {
  extractId,
  extractRecallInfo,
  findRecallInfoById,
  getFallbackValues,
  getRecallItems,
  recallToHeadline,
  replaceRecallInfoWithUnderline,
} from "@formbricks/lib/utils/recall";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";

const usePrevious = (value, initialValue) => {
  const ref = useRef(initialValue);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};
const useEffectDebugger = (effectHook, dependencies, dependencyNames = []) => {
  const previousDeps = usePrevious(dependencies, []);

  const changedDeps = dependencies.reduce((accum, dependency, index) => {
    if (dependency !== previousDeps[index]) {
      const keyName = dependencyNames[index] || index;
      return {
        ...accum,
        [keyName]: {
          before: previousDeps[index],
          after: dependency,
        },
      };
    }

    return accum;
  }, {});

  if (Object.keys(changedDeps).length) {
    console.log("[use-effect-debugger] ", changedDeps);
  }

  useEffect(effectHook, dependencies);
};

interface RecallWrapperRenderProps {
  value: string;
  onChange: (val: string) => void;
  highlightedJSX: JSX.Element[];
}

interface RecallWrapperProps {
  value: string;
  onChange: (val: string, recallItems: TSurveyRecallItem[], fallbacks: { [id: string]: string }) => void;
  localSurvey: TSurvey;
  questionId: string;
  contactAttributeKeys: TContactAttributeKey[];
  children: (props: RecallWrapperRenderProps) => React.ReactNode;
  usedLanguageCode: string;
  isRecallAllowed: boolean;
}

export const RecallWrapper = ({
  value,
  onChange,
  localSurvey,
  questionId,
  contactAttributeKeys,
  children,
  usedLanguageCode,
  isRecallAllowed,
}: RecallWrapperProps) => {
  const [internalValue, setInternalValue] = useState<string>(value);
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [recallItems, setRecallItems] = useState<TSurveyRecallItem[]>(
    internalValue.includes("#recall:")
      ? getRecallItems(internalValue, localSurvey, "default", contactAttributeKeys)
      : []
  );
  const [fallbacks, setFallbacks] = useState<{ [id: string]: string }>(
    internalValue.includes("/fallback:") ? getFallbackValues(internalValue) : {}
  );
  const [renderedText, setRenderedText] = useState<JSX.Element[]>([]);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  // useEffect(() => {
  //   setInternalValue(value);
  // }, [value]);

  const checkForRecallSymbol = useCallback((str: string) => {
    const pattern = /(^|\s)@(\s|$)/;
    pattern.test(str) ? setShowRecallItemSelect(true) : setShowRecallItemSelect(false);
  }, []);

  const handleInputChange = useCallback(
    (newVal: string) => {
      const updatedText = {
        [usedLanguageCode]: newVal,
      };

      const val = recallToHeadline(updatedText, localSurvey, false, usedLanguageCode, contactAttributeKeys)[
        usedLanguageCode
      ];
      setInternalValue(val);

      if (isRecallAllowed) {
        checkForRecallSymbol(val);
      }

      onChange(newVal, recallItems, fallbacks);
    },
    [
      checkForRecallSymbol,
      contactAttributeKeys,
      isRecallAllowed,
      localSurvey,
      onChange,
      recallItems,
      fallbacks,
      usedLanguageCode,
    ]
  );

  const addRecallItem = useCallback(
    (recallItem: TSurveyRecallItem) => {
      if (recallItem.label.trim() === "") {
        toast.error("Recall item label cannot be empty");
        return;
      }

      let recallItemTemp = structuredClone(recallItem);
      recallItemTemp.label = replaceRecallInfoWithUnderline(recallItem.label);

      setRecallItems((prevQuestions) => {
        const updatedQuestions = [...prevQuestions, recallItemTemp];
        return updatedQuestions;
      });

      if (!Object.keys(fallbacks).includes(recallItem.id)) {
        setFallbacks((prevFallbacks) => ({
          ...prevFallbacks,
          [recallItem.id]: "",
        }));
      }

      setShowRecallItemSelect(false);

      let modifiedHeadlineWithId = { [usedLanguageCode]: internalValue };
      modifiedHeadlineWithId[usedLanguageCode] = modifiedHeadlineWithId[usedLanguageCode].replace(
        /(?<=^|\s)@(?=\s|$)/g,
        `#recall:${recallItem.id}/fallback:# `
      );

      onChange(modifiedHeadlineWithId[usedLanguageCode], recallItems, fallbacks);

      // const modifiedHeadlineWithName = recallToHeadline(
      //   modifiedHeadlineWithId,
      //   localSurvey,
      //   false,
      //   usedLanguageCode,
      //   contactAttributeKeys
      // );

      // setInternalValue(modifiedHeadlineWithName[usedLanguageCode]);
      setInternalValue(modifiedHeadlineWithId[usedLanguageCode]);
      setShowFallbackInput(true);
    },
    [fallbacks, usedLanguageCode, internalValue, onChange, recallItems]
  );

  const addFallback = useCallback(() => {
    let newVal = internalValue;
    recallItems.forEach((item) => {
      const recallInfo = findRecallInfoById(newVal, item.id);
      console.log("recallInfo: ", recallInfo);
      if (recallInfo) {
        const fallbackValue = (fallbacks[item.id]?.trim() || "").replace(/ /g, "nbsp");
        let updatedFallbacks = { ...fallbacks };
        updatedFallbacks[item.id] = fallbackValue;
        setFallbacks(updatedFallbacks);
        newVal = newVal.replace(recallInfo, `#recall:${item.id}/fallback:${fallbackValue}#`);

        console.log("newVal: ", newVal, recallItems, updatedFallbacks);
        onChange(newVal, recallItems, updatedFallbacks);
      }
    });

    setShowFallbackInput(false);
  }, [fallbacks, recallItems, internalValue, onChange]);

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
        usedLanguageCode,
        contactAttributeKeys
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
  }, [internalValue, recallItems]);

  return (
    <div className="relative w-full">
      {children({
        value: internalValue,
        onChange: handleInputChange,
        highlightedJSX: renderedText,
      })}

      {showRecallItemSelect && (
        <RecallItemSelect
          localSurvey={localSurvey}
          questionId={questionId}
          addRecallItem={addRecallItem}
          setShowRecallItemSelect={setShowRecallItemSelect}
          recallItems={recallItems}
          selectedLanguageCode={usedLanguageCode}
          hiddenFields={localSurvey.hiddenFields}
          contactAttributeKeys={contactAttributeKeys}
        />
      )}

      {showFallbackInput && recallItems.length > 0 && (
        <FallbackInput
          filteredRecallItems={recallItems}
          fallbacks={fallbacks}
          setFallbacks={setFallbacks}
          fallbackInputRef={fallbackInputRef}
          addFallback={addFallback}
        />
      )}
    </div>
  );
};
