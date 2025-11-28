"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { debounce } from "lodash";
import { ImagePlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import {
  TSurveyElement,
  TSurveyElementChoice,
  TSurveyElementTypeEnum,
} from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyEndScreenCard, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { useSyncScroll } from "@/lib/utils/hooks/useSyncScroll";
import { recallToHeadline } from "@/lib/utils/recall";
import { LocalizedEditor } from "@/modules/ee/multi-language-surveys/components/localized-editor";
import { MultiLangWrapper } from "@/modules/survey/components/element-form-input/components/multi-lang-wrapper";
import { RecallWrapper } from "@/modules/survey/components/element-form-input/components/recall-wrapper";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import { FileInput } from "@/modules/ui/components/file-input";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
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

interface ElementFormInputProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  elementIdx: number;
  updateElement?: (elementIdx: number, data: Partial<TSurveyElement>) => void;
  updateSurvey?: (data: Partial<TSurveyEndScreenCard> | Partial<TSurveyRedirectUrlCard>) => void;
  updateChoice?: (choiceIdx: number, data: Partial<TSurveyElementChoice>) => void;
  updateMatrixLabel?: (index: number, type: "row" | "column", matrixLabel: TI18nString) => void;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  label: string;
  maxLength?: number;
  placeholder?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  className?: string;
  locale: TUserLocale;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  isStorageConfigured: boolean;
  autoFocus?: boolean;
  firstRender?: boolean;
  setFirstRender?: (value: boolean) => void;
  isExternalUrlsAllowed?: boolean;
}

export const ElementFormInput = ({
  id,
  value,
  localSurvey,
  elementIdx,
  updateElement,
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
  onKeyDown,
  isStorageConfigured = true,
  autoFocus,
  firstRender: externalFirstRender,
  setFirstRender: externalSetFirstRender,
  isExternalUrlsAllowed,
}: ElementFormInputProps) => {
  const { t } = useTranslation();
  const defaultLanguageCode =
    localSurvey.languages.filter((lang) => lang.default)[0]?.language.code ?? "default";
  const usedLanguageCode = selectedLanguageCode === defaultLanguageCode ? "default" : selectedLanguageCode;

  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const currentElement: TSurveyElement = elements[elementIdx];
  const isChoice = id.includes("choice");
  const isMatrixLabelRow = id.includes("row");
  const isMatrixLabelColumn = id.includes("column");
  const inputId = useMemo(() => {
    return isChoice || isMatrixLabelColumn || isMatrixLabelRow ? id.split("-")[0] : id;
  }, [id, isChoice, isMatrixLabelColumn, isMatrixLabelRow]);

  const isEndingCard = elementIdx >= elements.length;
  const isWelcomeCard = elementIdx === -1;
  const index = getIndex(id, isChoice || isMatrixLabelColumn || isMatrixLabelRow);

  const elementId = useMemo(() => {
    return isWelcomeCard
      ? "start"
      : isEndingCard
        ? localSurvey.endings[elementIdx - elements.length].id
        : currentElement.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWelcomeCard, isEndingCard, currentElement?.id]);
  const endingCard = localSurvey.endings.find((ending) => ending.id === elementId);

  const surveyLanguageCodes = useMemo(
    () => extractLanguageCodes(localSurvey.languages),
    [localSurvey.languages]
  );
  const isTranslationIncomplete = useMemo(
    () => isValueIncomplete(inputId, isInvalid, surveyLanguageCodes, value),
    [value, inputId, isInvalid, surveyLanguageCodes]
  );

  const elementText = useMemo((): TI18nString => {
    if (isChoice && typeof index === "number") {
      return getChoiceLabel(currentElement, index, surveyLanguageCodes);
    }

    if (isWelcomeCard) {
      return getWelcomeCardText(localSurvey, id, surveyLanguageCodes);
    }

    if (isEndingCard) {
      return getEndingCardText(localSurvey, elements, id, surveyLanguageCodes, elementIdx);
    }

    if ((isMatrixLabelColumn || isMatrixLabelRow) && typeof index === "number") {
      return getMatrixLabel(currentElement, index, surveyLanguageCodes, isMatrixLabelRow ? "row" : "column");
    }

    // For block-level properties (buttonLabel, backButtonLabel) or when value is explicitly provided,
    // use the value prop directly instead of looking up on currentElement
    if (value && typeof value === "object" && "default" in value) {
      return value;
    }

    return (
      (currentElement &&
        (id.includes(".")
          ? // Handle nested properties
            (currentElement[id.split(".")[0] as keyof TSurveyElement] as any)?.[id.split(".")[1]]
          : // Original behavior
            (currentElement[id as keyof TSurveyElement] as TI18nString))) ||
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
    currentElement,
    elementIdx,
    elements,
    surveyLanguageCodes,
    value,
  ]);

  const [text, setText] = useState(elementText);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(
    determineImageUploaderVisibility(elementIdx, elements)
  );

  // Sync text state when elementText changes (e.g., on page reload or when value prop changes)
  useEffect(() => {
    setText(elementText);
  }, [elementText]);

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

  const updateElementDetails = useCallback(
    (translatedText: TI18nString) => {
      if (updateElement) {
        // Handle nested properties if id contains a dot
        if (id.includes(".")) {
          const [parent, child] = id.split(".");
          updateElement(elementIdx, {
            [parent]: {
              ...currentElement[parent],
              [child]: translatedText,
            },
          });
        } else {
          // Original behavior for non-nested properties
          updateElement(elementIdx, { [id]: translatedText });
        }
      }
    },
    [id, elementIdx, updateElement, currentElement]
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
        updateElementDetails(translatedText);
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
      updateElementDetails,
      updateSurveyDetails,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (onKeyDown) onKeyDown(e);
    },
    [onKeyDown]
  );

  const getFileUrl = (): string | undefined => {
    if (isWelcomeCard) return localSurvey.welcomeCard.fileUrl;
    if (isEndingCard) {
      if (endingCard && endingCard.type === "endScreen") return endingCard.imageUrl;
    } else return currentElement.imageUrl;
  };

  const getVideoUrl = (): string | undefined => {
    if (isWelcomeCard) return localSurvey.welcomeCard.videoUrl;
    if (isEndingCard) {
      if (endingCard && endingCard.type === "endScreen") return endingCard.videoUrl;
    } else return currentElement.videoUrl;
  };

  const debouncedHandleUpdate = useMemo(() => debounce((value) => handleUpdate(value), 100), [handleUpdate]);

  const [animationParent] = useAutoAnimate();
  const [internalFirstRender, setInternalFirstRender] = useState(true);
  const suppressEditorUpdatesRef = useRef(false);

  // Use external firstRender state if provided, otherwise use internal state
  const firstRender = externalFirstRender ?? internalFirstRender;
  const setFirstRender = externalSetFirstRender ?? setInternalFirstRender;

  const renderRemoveDescriptionButton = () => {
    if (
      currentElement &&
      (currentElement.type === TSurveyElementTypeEnum.CTA ||
        currentElement.type === TSurveyElementTypeEnum.Consent)
    ) {
      return false;
    }

    if (id === "subheader") {
      return !!currentElement?.subheader || (endingCard?.type === "endScreen" && !!endingCard?.subheader);
    }

    return false;
  };

  const getIsRequiredToggleDisabled = (): boolean => {
    if (!currentElement) return false;

    // CTA elements should always have the required toggle disabled
    if (currentElement.type === TSurveyElementTypeEnum.CTA) {
      return true;
    }

    if (currentElement.type === TSurveyElementTypeEnum.Address) {
      const allFieldsAreOptional = [
        currentElement.addressLine1,
        currentElement.addressLine2,
        currentElement.city,
        currentElement.state,
        currentElement.zip,
        currentElement.country,
      ]
        .filter((field) => field.show)
        .every((field) => !field.required);

      if (allFieldsAreOptional) {
        return true;
      }

      return [
        currentElement.addressLine1,
        currentElement.addressLine2,
        currentElement.city,
        currentElement.state,
        currentElement.zip,
        currentElement.country,
      ]
        .filter((field) => field.show)
        .some((condition) => condition.required === true);
    }

    if (currentElement.type === TSurveyElementTypeEnum.ContactInfo) {
      const allFieldsAreOptional = [
        currentElement.firstName,
        currentElement.lastName,
        currentElement.email,
        currentElement.phone,
        currentElement.company,
      ]
        .filter((field) => field.show)
        .every((field) => !field.required);

      if (allFieldsAreOptional) {
        return true;
      }

      return [
        currentElement.firstName,
        currentElement.lastName,
        currentElement.email,
        currentElement.phone,
        currentElement.company,
      ]
        .filter((field) => field.show)
        .some((condition) => condition.required === true);
    }

    return false;
  };

  const useRichTextEditor = id === "headline" || id === "subheader" || id === "html";

  // For rich text editor fields, we need either updateElement or updateSurvey
  if (useRichTextEditor && !updateElement && !updateSurvey) {
    throw new Error("Either updateElement or updateSurvey must be provided");
  }

  if (useRichTextEditor) {
    return (
      <div className="w-full">
        {label && (
          <div className="mb-2 mt-3 flex items-center justify-between">
            <Label htmlFor={id}>{label}</Label>
            {id === "headline" && currentElement && updateElement && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="required-toggle" className="text-sm">
                  {t("environments.surveys.edit.required")}
                </Label>
                <Switch
                  id="required-toggle"
                  checked={currentElement.required}
                  disabled={getIsRequiredToggleDisabled()}
                  onCheckedChange={(checked) => {
                    updateElement(elementIdx, { required: checked });
                  }}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-4" ref={animationParent}>
          {showImageUploader && id === "headline" && (
            <FileInput
              id="element-image"
              allowedFileExtensions={["png", "jpeg", "jpg", "webp", "heic"]}
              environmentId={localSurvey.environmentId}
              onFileUpload={(url: string[] | undefined, fileType: "image" | "video") => {
                if (url) {
                  const update =
                    fileType === "video"
                      ? { videoUrl: url[0], imageUrl: undefined }
                      : { imageUrl: url[0], videoUrl: undefined };
                  if ((isWelcomeCard || isEndingCard) && updateSurvey) {
                    updateSurvey(update);
                  } else if (updateElement) {
                    updateElement(elementIdx, update);
                  }
                }
              }}
              fileUrl={getFileUrl()}
              videoUrl={getVideoUrl()}
              isVideoAllowed={true}
              maxSizeInMB={5}
              isStorageConfigured={isStorageConfigured}
            />
          )}

          <div className="flex w-full items-start gap-2">
            <div className="flex-1">
              <LocalizedEditor
                key={`${elementId}-${id}-${selectedLanguageCode}`}
                id={id}
                value={value}
                localSurvey={localSurvey}
                elementIdx={elementIdx}
                isInvalid={isInvalid}
                updateElement={(isWelcomeCard || isEndingCard ? updateSurvey : updateElement)!}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                firstRender={firstRender}
                setFirstRender={setFirstRender}
                locale={locale}
                elementId={elementId}
                isCard={isWelcomeCard || isEndingCard}
                autoFocus={autoFocus}
                isExternalUrlsAllowed={isExternalUrlsAllowed}
                suppressUpdates={() => suppressEditorUpdatesRef.current}
              />
            </div>

            {id === "headline" && !isWelcomeCard && (
              <TooltipRenderer
                tooltipContent={t("environments.surveys.edit.add_photo_or_video")}
                delayDuration={100}>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Toggle image uploader"
                  data-testid="toggle-image-uploader-button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowImageUploader((prev) => !prev);
                  }}>
                  <ImagePlusIcon />
                </Button>
              </TooltipRenderer>
            )}

            {id === "subheader" && renderRemoveDescriptionButton() && (
              <TooltipRenderer tooltipContent={t("environments.surveys.edit.remove_description")}>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Remove description"
                  onClick={(e) => {
                    e.preventDefault();

                    // Suppress Editor updates BEFORE calling updateElement to prevent race condition
                    // Use ref for immediate synchronous access
                    if (id === "subheader") {
                      suppressEditorUpdatesRef.current = true;
                    }

                    if (updateSurvey) {
                      updateSurvey({ subheader: undefined });
                    }

                    if (updateElement) {
                      updateElement(elementIdx, { subheader: undefined });
                    }

                    // Re-enable updates after a short delay to allow state to update
                    if (id === "subheader") {
                      setTimeout(() => {
                        suppressEditorUpdatesRef.current = false;
                      }, 100);
                    }
                  }}>
                  <TrashIcon />
                </Button>
              </TooltipRenderer>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 mt-3 flex items-center justify-between">
          <Label htmlFor={id}>{label}</Label>
          {id === "headline" && currentElement && updateElement && (
            <div className="flex items-center space-x-2">
              <Label htmlFor="required-toggle" className="text-sm">
                {t("environments.surveys.edit.required")}
              </Label>
              <Switch
                id="required-toggle"
                checked={currentElement.required}
                disabled={getIsRequiredToggleDisabled()}
                onCheckedChange={(checked) => {
                  updateElement(elementIdx, { required: checked });
                }}
              />
            </div>
          )}
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
              elementId={elementId}
              value={value[usedLanguageCode]}
              onChange={(value, recallItems, fallbacks) => {
                // Pass all values to MultiLangWrapper's onChange
                onChange(value, recallItems, fallbacks);
              }}
              onAddFallback={() => {
                inputRef.current?.focus();
              }}
              isRecallAllowed={false}
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
                    <div className="flex w-full items-center space-x-2">
                      <div className="group relative w-full">
                        {languageIndicator}
                        {/* The highlight container is absolutely positioned behind the input */}
                        <div className="h-10 w-full"></div>
                        <div
                          ref={highlightContainerRef}
                          className={`no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent ${
                            localSurvey.languages?.length > 1 ? "pr-24" : ""
                          }`}
                          dir="auto"
                          key={highlightedJSX.toString()}>
                          {highlightedJSX}
                        </div>

                        <Input
                          key={`${elementId}-${id}-${usedLanguageCode}`}
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
                          autoFocus={false}
                          onKeyDown={handleKeyDown}
                        />
                        {recallComponents}
                      </div>
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
ElementFormInput.displayName = "ElementFormInput";
