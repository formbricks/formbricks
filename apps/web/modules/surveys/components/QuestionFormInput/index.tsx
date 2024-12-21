"use client";

import { LanguageIndicator } from "@/modules/ee/multi-language-surveys/components/language-indicator";
import { Button } from "@/modules/ui/components/button";
import { FileInput } from "@/modules/ui/components/file-input";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { debounce } from "lodash";
import { ImagePlusIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type JSX, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  createI18nString,
  extractLanguageCodes,
  getEnabledLanguages,
  getLocalizedValue,
} from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { useSyncScroll } from "@formbricks/lib/utils/hooks/useSyncScroll";
import {
  extractId,
  extractRecallInfo,
  findRecallInfoById,
  getFallbackValues,
  getRecallItems,
  headlineToRecall,
  recallToHeadline,
  replaceRecallInfoWithUnderline,
} from "@formbricks/lib/utils/recall";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  TI18nString,
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyQuestion,
  TSurveyQuestionChoice,
  TSurveyRecallItem,
  TSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { FallbackInput } from "./components/FallbackInput";
import { RecallItemSelect } from "./components/RecallItemSelect";
import {
  determineImageUploaderVisibility,
  getChoiceLabel,
  getEndingCardText,
  getIndex,
  getMatrixLabel,
  getPlaceHolderById,
  getWelcomeCardText,
  isValueIncomplete,
} from "./utils";

interface QuestionFormInputProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  questionIdx: number;
  updateQuestion?: (questionIdx: number, data: Partial<TSurveyQuestion>) => void;
  updateSurvey?: (data: Partial<TSurveyEndScreenCard> | Partial<TSurveyRedirectUrlCard>) => void;
  updateChoice?: (choiceIdx: number, data: Partial<TSurveyQuestionChoice>) => void;
  updateMatrixLabel?: (index: number, type: "row" | "column", data: Partial<TSurveyQuestion>) => void;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  label: string;
  maxLength?: number;
  placeholder?: string;
  ref?: RefObject<HTMLInputElement | null>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  className?: string;
  contactAttributeKeys: TContactAttributeKey[];
  locale: TUserLocale;
}

export const QuestionFormInput = ({
  id,
  value,
  localSurvey,
  questionIdx,
  updateQuestion,
  updateSurvey,
  updateChoice,
  updateMatrixLabel,
  isInvalid,
  label,
  selectedLanguageCode,
  setSelectedLanguageCode,
  maxLength,
  placeholder,
  onBlur,
  className,
  contactAttributeKeys,
  locale,
}: QuestionFormInputProps) => {
  const t = useTranslations();
  const defaultLanguageCode =
    localSurvey.languages.filter((lang) => lang.default)[0]?.language.code ?? "default";
  const usedLanguageCode = selectedLanguageCode === defaultLanguageCode ? "default" : selectedLanguageCode;
  const question: TSurveyQuestion = localSurvey.questions[questionIdx];
  const isChoice = id.includes("choice");
  const isMatrixLabelRow = id.includes("row");
  const isMatrixLabelColumn = id.includes("column");
  const isEndingCard = questionIdx >= localSurvey.questions.length;
  const isWelcomeCard = questionIdx === -1;
  const index = getIndex(id, isChoice || isMatrixLabelColumn || isMatrixLabelRow);

  const questionId = useMemo(() => {
    return isWelcomeCard
      ? "start"
      : isEndingCard
        ? localSurvey.endings[questionIdx - localSurvey.questions.length].id
        : question.id;
  }, [isWelcomeCard, isEndingCard, question?.id]);

  const enabledLanguages = useMemo(
    () => getEnabledLanguages(localSurvey.languages ?? []),
    [localSurvey.languages]
  );

  const surveyLanguageCodes = useMemo(
    () => extractLanguageCodes(localSurvey.languages),
    [localSurvey.languages]
  );
  const isTranslationIncomplete = useMemo(
    () => isValueIncomplete(id, isInvalid, surveyLanguageCodes, value),
    [value, id, isInvalid, surveyLanguageCodes]
  );

  const elementText = useMemo((): TI18nString => {
    if (isChoice && typeof index === "number") {
      return getChoiceLabel(question, index, surveyLanguageCodes);
    }

    if (isWelcomeCard) {
      return getWelcomeCardText(localSurvey, id, surveyLanguageCodes);
    }

    if (isEndingCard) {
      return getEndingCardText(localSurvey, id, surveyLanguageCodes, questionIdx);
    }

    if ((isMatrixLabelColumn || isMatrixLabelRow) && typeof index === "number") {
      return getMatrixLabel(question, index, surveyLanguageCodes, isMatrixLabelRow ? "row" : "column");
    }

    return (
      (question && (question[id as keyof TSurveyQuestion] as TI18nString)) ||
      createI18nString("", surveyLanguageCodes)
    );
  }, [
    id,
    index,
    isChoice,
    isEndingCard,
    isMatrixLabelColumn,
    isMatrixLabelRow,
    isWelcomeCard,
    localSurvey,
    question,
    questionIdx,
    surveyLanguageCodes,
  ]);

  const [text, setText] = useState(elementText);
  const [renderedText, setRenderedText] = useState<JSX.Element[]>();
  const [showImageUploader, setShowImageUploader] = useState<boolean>(
    determineImageUploaderVisibility(questionIdx, localSurvey)
  );
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [recallItems, setRecallItems] = useState<TSurveyRecallItem[]>(
    getLocalizedValue(text, usedLanguageCode).includes("#recall:")
      ? getRecallItems(
          getLocalizedValue(text, usedLanguageCode),
          localSurvey,
          usedLanguageCode,
          contactAttributeKeys
        )
      : []
  );

  const [fallbacks, setFallbacks] = useState<{ [type: string]: string }>(() => {
    const localizedValue = getLocalizedValue(text, usedLanguageCode);
    return localizedValue.includes("/fallback:") ? getFallbackValues(localizedValue) : {};
  });

  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredRecallItems = Array.from(new Set(recallItems.map((q) => q.id))).map((id) => {
    return recallItems.find((q) => q.id === id);
  });

  // Hook to synchronize the horizontal scroll position of highlightContainerRef and inputRef.
  useSyncScroll(highlightContainerRef, inputRef);

  useEffect(() => {
    setRecallItems(
      getLocalizedValue(text, usedLanguageCode).includes("#recall:")
        ? getRecallItems(
            getLocalizedValue(text, usedLanguageCode),
            localSurvey,
            usedLanguageCode,
            contactAttributeKeys
          )
        : []
    );
  }, [usedLanguageCode]);

  useEffect(() => {
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
      let remainingText = recallToHeadline(text, localSurvey, false, usedLanguageCode, contactAttributeKeys)[
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
    if (fallbackInputRef.current) {
      fallbackInputRef.current.focus();
    }
  }, [showFallbackInput]);

  // useEffect(() => {
  //   setText(getElementTextBasedOnType());
  // }, [localSurvey]);

  const checkForRecallSymbol = useCallback(
    (value: TI18nString) => {
      const pattern = /(^|\s)@(\s|$)/;
      if (pattern.test(getLocalizedValue(value, usedLanguageCode))) {
        setShowRecallItemSelect(true);
      } else {
        setShowRecallItemSelect(false);
      }
    },
    [usedLanguageCode]
  );

  // updation of questions, WelcomeCard, ThankYouCard and choices is done in a different manner,
  // questions -> updateQuestion
  // thankYouCard, welcomeCard-> updateSurvey
  // choice -> updateChoice
  // matrixLabel -> updateMatrixLabel

  const createUpdatedText = useCallback(
    (updatedText: string): TI18nString => {
      return {
        ...elementText,
        [usedLanguageCode]: updatedText,
      };
    },
    [elementText, usedLanguageCode]
  );

  const updateChoiceDetails = useCallback(
    (translatedText: TI18nString) => {
      if (updateChoice && typeof index === "number") {
        updateChoice(index, { label: translatedText });
      }
    },
    [index, updateChoice]
  );

  const updateSurveyDetails = useCallback(
    (translatedText: TI18nString) => {
      if (updateSurvey) {
        updateSurvey({ [id]: translatedText });
      }
    },
    [id, updateSurvey]
  );

  const updateMatrixLabelDetails = useCallback(
    (translatedText: TI18nString) => {
      if (updateMatrixLabel && typeof index === "number") {
        updateMatrixLabel(index, isMatrixLabelRow ? "row" : "column", translatedText);
      }
    },
    [index, isMatrixLabelRow, updateMatrixLabel]
  );

  const updateQuestionDetails = useCallback(
    (translatedText: TI18nString) => {
      if (updateQuestion) {
        updateQuestion(questionIdx, { [id]: translatedText });
      }
    },
    [id, questionIdx, updateQuestion]
  );

  const handleUpdate = useCallback(
    (updatedText: string) => {
      const translatedText = createUpdatedText(updatedText);

      if (isChoice) {
        updateChoiceDetails(translatedText);
      } else if (isEndingCard || isWelcomeCard) {
        updateSurveyDetails(translatedText);
      } else if (isMatrixLabelRow || isMatrixLabelColumn) {
        updateMatrixLabelDetails(translatedText);
      } else {
        updateQuestionDetails(translatedText);
      }
    },
    [
      createUpdatedText,
      isChoice,
      isEndingCard,
      isMatrixLabelColumn,
      isMatrixLabelRow,
      isWelcomeCard,
      updateChoiceDetails,
      updateMatrixLabelDetails,
      updateQuestionDetails,
      updateSurveyDetails,
    ]
  );

  // Adds a new recall question to the recallItems array, updates fallbacks, modifies the text with recall details.
  const addRecallItem = useCallback(
    (recallItem: TSurveyRecallItem) => {
      if (recallItem.label.trim() === "") {
        toast.error(t("environments.surveys.edit.cannot_add_question_with_empty_headline_as_recall"));
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

      let modifiedHeadlineWithId = { ...elementText };
      modifiedHeadlineWithId[usedLanguageCode] = getLocalizedValue(
        modifiedHeadlineWithId,
        usedLanguageCode
      ).replace(/(?<=^|\s)@(?=\s|$)/g, `#recall:${recallItem.id}/fallback:# `);

      handleUpdate(getLocalizedValue(modifiedHeadlineWithId, usedLanguageCode));

      const modifiedHeadlineWithName = recallToHeadline(
        modifiedHeadlineWithId,
        localSurvey,
        false,
        usedLanguageCode,
        contactAttributeKeys
      );

      setText(modifiedHeadlineWithName);
      setShowFallbackInput(true);
    },
    [contactAttributeKeys, elementText, fallbacks, handleUpdate, localSurvey, usedLanguageCode]
  );

  // Filters and updates the list of recall questions based on their presence in the given text, also managing related text and fallback states.
  const filterRecallItems = useCallback(
    (remainingText: string) => {
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
    },
    [fallbacks, handleUpdate, recallItems, text, usedLanguageCode]
  );

  const addFallback = () => {
    let headlineWithFallback = elementText;
    filteredRecallItems.forEach((recallQuestion) => {
      if (recallQuestion) {
        const recallInfo = findRecallInfoById(
          getLocalizedValue(headlineWithFallback, usedLanguageCode),
          recallQuestion!.id
        );
        if (recallInfo) {
          let fallBackValue = fallbacks[recallQuestion.id].trim();
          fallBackValue = fallBackValue.replace(/ /g, "nbsp");
          let updatedFallback = { ...fallbacks };
          updatedFallback[recallQuestion.id] = fallBackValue;
          setFallbacks(updatedFallback);
          headlineWithFallback[usedLanguageCode] = getLocalizedValue(
            headlineWithFallback,
            usedLanguageCode
          ).replace(recallInfo, `#recall:${recallQuestion?.id}/fallback:${fallBackValue}#`);
          handleUpdate(getLocalizedValue(headlineWithFallback, usedLanguageCode));
        }
      }
    });
    setShowFallbackInput(false);
    inputRef.current?.focus();
  };

  const getFileUrl = (): string | undefined => {
    if (isWelcomeCard) return localSurvey.welcomeCard.fileUrl;
    if (isEndingCard) {
      const endingCard = localSurvey.endings.find((ending) => ending.id === questionId);
      if (endingCard && endingCard.type === "endScreen") return endingCard.imageUrl;
    } else return question.imageUrl;
  };

  const getVideoUrl = (): string | undefined => {
    if (isWelcomeCard) return localSurvey.welcomeCard.videoUrl;
    if (isEndingCard) {
      const endingCard = localSurvey.endings.find((ending) => ending.id === questionId);
      if (endingCard && endingCard.type === "endScreen") return endingCard.videoUrl;
    } else return question.videoUrl;
  };

  const debouncedHandleUpdate = useMemo(
    () => debounce((value) => handleUpdate(headlineToRecall(value, recallItems, fallbacks)), 100),
    [handleUpdate, recallItems, fallbacks]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const updatedText = {
      ...elementText,
      [usedLanguageCode]: value,
    };

    const valueTI18nString = recallToHeadline(
      updatedText,
      localSurvey,
      false,
      usedLanguageCode,
      contactAttributeKeys
    );

    setText(valueTI18nString);

    if (id === "headline" || id === "subheader") {
      checkForRecallSymbol(valueTI18nString);
    }

    debouncedHandleUpdate(value);
  };

  const [animationParent] = useAutoAnimate();

  return (
    <div className="w-full">
      <div className="w-full">
        {label && (
          <div className="mb-2 mt-3">
            <Label htmlFor={id}>{label}</Label>
          </div>
        )}

        <div className="flex flex-col gap-4 bg-white" ref={animationParent}>
          {showImageUploader && id === "headline" && (
            <FileInput
              id="question-image"
              allowedFileExtensions={["png", "jpeg", "jpg", "webp"]}
              environmentId={localSurvey.environmentId}
              onFileUpload={(url: string[] | undefined, fileType: "image" | "video") => {
                if (url) {
                  const update =
                    fileType === "video"
                      ? { videoUrl: url[0], imageUrl: "" }
                      : { imageUrl: url[0], videoUrl: "" };
                  if (isEndingCard && updateSurvey) {
                    updateSurvey(update);
                  } else if (updateQuestion) {
                    updateQuestion(questionIdx, update);
                  }
                }
              }}
              fileUrl={getFileUrl()}
              videoUrl={getVideoUrl()}
              isVideoAllowed={true}
            />
          )}
          <div className="flex items-center space-x-2">
            <div className="group relative w-full">
              <div className="h-10 w-full"></div>
              <div
                id="wrapper"
                ref={highlightContainerRef}
                className={`no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent ${
                  localSurvey.languages?.length > 1 ? "pr-24" : ""
                }`}
                dir="auto">
                {renderedText}
              </div>
              {getLocalizedValue(elementText, usedLanguageCode).includes("recall:") && (
                <button
                  className="fixed right-14 hidden items-center rounded-b-lg bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200 group-hover:flex"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowFallbackInput(true);
                  }}>
                  {t("environments.surveys.edit.edit_recall")}
                  <PencilIcon className="ml-2 h-3 w-3" />
                </button>
              )}
              <Input
                key={`${questionId}-${id}-${usedLanguageCode}`}
                dir="auto"
                className={`absolute top-0 text-black caret-black ${
                  localSurvey.languages?.length > 1 ? "pr-24" : ""
                } ${className}`}
                placeholder={placeholder ? placeholder : getPlaceHolderById(id, t)}
                id={id}
                name={id}
                aria-label={label}
                autoComplete={showRecallItemSelect ? "off" : "on"}
                value={
                  recallToHeadline(text, localSurvey, false, usedLanguageCode, contactAttributeKeys)[
                    usedLanguageCode
                  ]
                }
                onChange={handleInputChange}
                ref={inputRef}
                onBlur={onBlur}
                maxLength={maxLength ?? undefined}
                autoFocus={id === "headline"}
                isInvalid={
                  isInvalid &&
                  text[usedLanguageCode]?.trim() === "" &&
                  localSurvey.languages?.length > 1 &&
                  isTranslationIncomplete
                }
              />
              {enabledLanguages.length > 1 && (
                <LanguageIndicator
                  selectedLanguageCode={usedLanguageCode}
                  surveyLanguages={enabledLanguages}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  locale={locale}
                />
              )}
              {!showRecallItemSelect && showFallbackInput && recallItems.length > 0 && (
                <FallbackInput
                  filteredRecallItems={filteredRecallItems}
                  fallbacks={fallbacks}
                  setFallbacks={setFallbacks}
                  fallbackInputRef={fallbackInputRef}
                  addFallback={addFallback}
                />
              )}
            </div>
            {id === "headline" && !isWelcomeCard && (
              <TooltipRenderer tooltipContent={t("environments.surveys.edit.add_photo_or_video")}>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Toggle image uploader"
                  className="ml-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowImageUploader((prev) => !prev);
                  }}>
                  <ImagePlusIcon />
                </Button>
              </TooltipRenderer>
            )}
            {id === "subheader" && question && question.subheader !== undefined && (
              <TooltipRenderer tooltipContent={t("environments.surveys.edit.remove_description")}>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Remove description"
                  className="ml-2"
                  onClick={(e) => {
                    e.preventDefault();
                    if (updateQuestion) {
                      updateQuestion(questionIdx, { subheader: undefined });
                    }
                  }}>
                  <TrashIcon />
                </Button>
              </TooltipRenderer>
            )}
          </div>
        </div>
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
      </div>
      {usedLanguageCode !== "default" && value && typeof value["default"] !== undefined && (
        <div className="mt-1 text-xs text-slate-500">
          <strong>{t("environments.project.languages.translate")}:</strong>{" "}
          {recallToHeadline(value, localSurvey, false, "default", contactAttributeKeys)["default"]}
        </div>
      )}
      {usedLanguageCode === "default" && localSurvey.languages?.length > 1 && isTranslationIncomplete && (
        <div className="mt-1 text-xs text-red-400">
          {t("environments.project.languages.incomplete_translations")}
        </div>
      )}
    </div>
  );
};
QuestionFormInput.displayName = "QuestionFormInput";
