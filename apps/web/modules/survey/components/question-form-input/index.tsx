"use client";

import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { useSyncScroll } from "@/lib/utils/hooks/useSyncScroll";
import { recallToHeadline } from "@/lib/utils/recall";
import { MultiLangWrapper } from "@/modules/survey/components/question-form-input/components/multi-lang-wrapper";
import { RecallWrapper } from "@/modules/survey/components/question-form-input/components/recall-wrapper";
import { Button } from "@/modules/ui/components/button";
import { FileInput } from "@/modules/ui/components/file-input";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { debounce } from "lodash";
import { ImagePlusIcon, TrashIcon } from "lucide-react";
import { RefObject, useCallback, useMemo, useRef, useState } from "react";
import {
  TI18nString,
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyQuestion,
  TSurveyQuestionChoice,
  TSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
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
  locale,
}: QuestionFormInputProps) => {
  const { t } = useTranslate();
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
    //eslint-disable-next-line
  }, [isWelcomeCard, isEndingCard, question?.id]);
  const endingCard = localSurvey.endings.find((ending) => ending.id === questionId);

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
      (question &&
        (id.includes(".")
          ? // Handle nested properties
            (question[id.split(".")[0] as keyof TSurveyQuestion] as any)?.[id.split(".")[1]]
          : // Original behavior
            (question[id as keyof TSurveyQuestion] as TI18nString))) ||
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
  const [showImageUploader, setShowImageUploader] = useState<boolean>(
    determineImageUploaderVisibility(questionIdx, localSurvey)
  );

  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hook to synchronize the horizontal scroll position of highlightContainerRef and inputRef.
  useSyncScroll(highlightContainerRef, inputRef);

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
        // Handle nested properties if id contains a dot
        if (id.includes(".")) {
          const [parent, child] = id.split(".");
          updateQuestion(questionIdx, {
            [parent]: {
              ...question[parent],
              [child]: translatedText,
            },
          });
        } else {
          // Original behavior for non-nested properties
          updateQuestion(questionIdx, { [id]: translatedText });
        }
      }
    },
    [id, questionIdx, updateQuestion, question]
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

  const getFileUrl = (): string | undefined => {
    if (isWelcomeCard) return localSurvey.welcomeCard.fileUrl;
    if (isEndingCard) {
      if (endingCard && endingCard.type === "endScreen") return endingCard.imageUrl;
    } else return question.imageUrl;
  };

  const getVideoUrl = (): string | undefined => {
    if (isWelcomeCard) return localSurvey.welcomeCard.videoUrl;
    if (isEndingCard) {
      if (endingCard && endingCard.type === "endScreen") return endingCard.videoUrl;
    } else return question.videoUrl;
  };

  const debouncedHandleUpdate = useMemo(() => debounce((value) => handleUpdate(value), 100), [handleUpdate]);

  const [animationParent] = useAutoAnimate();

  const renderRemoveDescriptionButton = useMemo(() => {
    if (id !== "subheader") return false;
    return !!question?.subheader || (endingCard?.type === "endScreen" && !!endingCard?.subheader);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endingCard?.type, id, question?.subheader]);

  return (
    <div className="w-full">
      {label && (
        <div className="mt-3 mb-2">
          <Label htmlFor={id}>{label}</Label>
        </div>
      )}
      <MultiLangWrapper
        isTranslationIncomplete={isTranslationIncomplete}
        value={text}
        localSurvey={localSurvey}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        key={selectedLanguageCode}
        onChange={(updatedText) => {
          setText(updatedText);
          debouncedHandleUpdate(updatedText[usedLanguageCode]);
        }}
        render={({ value, onChange, children: languageIndicator }) => {
          return (
            <RecallWrapper
              localSurvey={localSurvey}
              questionId={questionId}
              value={value[usedLanguageCode]}
              onChange={(value, recallItems, fallbacks) => {
                // Pass all values to MultiLangWrapper's onChange
                onChange(value, recallItems, fallbacks);
              }}
              onAddFallback={() => {
                inputRef.current?.focus();
              }}
              isRecallAllowed={!isWelcomeCard && (id === "headline" || id === "subheader")}
              usedLanguageCode={usedLanguageCode}
              render={({
                value,
                onChange,
                highlightedJSX,
                children: recallComponents,
                isRecallSelectVisible,
              }) => {
                return (
                  <div className="flex flex-col gap-4 bg-white" ref={animationParent}>
                    {showImageUploader && id === "headline" && (
                      <FileInput
                        id="question-image"
                        allowedFileExtensions={["png", "jpeg", "jpg", "webp", "heic"]}
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

                    <div className="flex w-full items-center space-x-2">
                      <div className="group relative w-full">
                        {languageIndicator}
                        {/* The highlight container is absolutely positioned behind the input */}
                        <div className="h-10 w-full"></div>
                        <div
                          ref={highlightContainerRef}
                          className={`no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll px-3 py-2 text-center text-sm whitespace-nowrap text-transparent ${
                            localSurvey.languages?.length > 1 ? "pr-24" : ""
                          }`}
                          dir="auto"
                          key={highlightedJSX.toString()}>
                          {highlightedJSX}
                        </div>

                        <Input
                          key={`${questionId}-${id}-${usedLanguageCode}`}
                          value={
                            recallToHeadline(
                              {
                                [usedLanguageCode]: value,
                              },
                              localSurvey,
                              false,
                              usedLanguageCode
                            )[usedLanguageCode]
                          }
                          dir="auto"
                          onChange={(e) => onChange(e.target.value)}
                          id={id}
                          name={id}
                          placeholder={placeholder ?? getPlaceHolderById(id, t)}
                          aria-label={label}
                          maxLength={maxLength}
                          ref={inputRef}
                          onBlur={onBlur}
                          className={`absolute top-0 text-black caret-black ${
                            localSurvey.languages?.length > 1 ? "pr-24" : ""
                          } ${className}`}
                          isInvalid={
                            isInvalid &&
                            text[usedLanguageCode]?.trim() === "" &&
                            localSurvey.languages?.length > 1 &&
                            isTranslationIncomplete
                          }
                          autoComplete={isRecallSelectVisible ? "off" : "on"}
                          autoFocus={id === "headline"}
                        />
                        {recallComponents}
                      </div>

                      <>
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
                        {renderRemoveDescriptionButton ? (
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
                                if (updateSurvey) {
                                  updateSurvey({ subheader: undefined });
                                }
                              }}>
                              <TrashIcon />
                            </Button>
                          </TooltipRenderer>
                        ) : null}
                      </>
                    </div>
                  </div>
                );
              }}
            />
          );
        }}
      />
    </div>
  );
};
QuestionFormInput.displayName = "QuestionFormInput";
