import { useEffect, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { type TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  type TSurveyElement,
  type TSurveyMatrixElement,
  type TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { TValidationErrorMap } from "@formbricks/types/surveys/validation-rules";
import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { ElementConditional } from "@/components/general/element-conditional";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getFirstErrorMessage, validateBlockResponses } from "@/lib/validation/evaluator";

interface BlockConditionalProps {
  block: TSurveyBlock;
  value: TResponseData;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  isFirstBlock: boolean;
  isLastBlock: boolean;
  languageCode: string;
  prefilledResponseData?: TResponseData;
  skipPrefilled?: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  surveyId: string;
  autoFocusEnabled: boolean;
  isBackButtonHidden: boolean;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  dir?: "ltr" | "rtl" | "auto";
  fullSizeCards: boolean;
}

export function BlockConditional({
  block,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstBlock,
  isLastBlock,
  languageCode,
  prefilledResponseData,
  skipPrefilled,
  ttc,
  setTtc,
  surveyId,
  onFileUpload,
  autoFocusEnabled,
  isBackButtonHidden,
  onOpenExternalURL,
  dir,
  fullSizeCards,
}: BlockConditionalProps) {
  const { t } = useTranslation();

  // Track the current element being filled (for TTC tracking)
  const [currentElementId, setCurrentElementId] = useState(block.elements[0]?.id);

  // State to store validation errors from centralized validation
  const [elementErrors, setElementErrors] = useState<TValidationErrorMap>({});

  // Refs to store form elements for each element so we can trigger their validation
  const elementFormRefs = useRef<Map<string, HTMLFormElement>>(new Map());

  // Ref to collect TTC values synchronously (state updates are async)
  const ttcCollectorRef = useRef<TResponseTtc>({});

  // Handle change for an individual element
  const handleElementChange = (elementId: string, responseData: TResponseData) => {
    // If user moved to a different element, we should track it
    if (elementId !== currentElementId) {
      setCurrentElementId(elementId);
    }
    // Clear error for this element when user makes a change
    if (elementErrors[elementId]) {
      setElementErrors((prev: TValidationErrorMap) => {
        const updated = { ...prev };
        delete updated[elementId];
        return updated;
      });
    }
    // Merge with existing block data to preserve other element values
    onChange({ ...value, ...responseData });
  };

  // Handler to collect TTC values synchronously (called from element form submissions)
  const handleTtcCollect = (elementId: string, elementTtc: number) => {
    ttcCollectorRef.current[elementId] = elementTtc;
  };

  // Handle prefilling at block level (both skipPrefilled and regular prefilling)
  useEffect(() => {
    if (prefilledResponseData) {
      // Collect all prefilled values for elements in this block
      const prefilledData: TResponseData = {};
      let hasAnyPrefilled = false;

      block.elements.forEach((element) => {
        if (prefilledResponseData[element.id] !== undefined) {
          prefilledData[element.id] = prefilledResponseData[element.id];
          hasAnyPrefilled = true;
        }
      });

      if (hasAnyPrefilled) {
        // Apply all prefilled values in one atomic operation
        onChange(prefilledData);

        // If skipPrefilled and ALL elements are prefilled, auto-submit
        if (skipPrefilled) {
          const allElementsPrefilled = block.elements.every(
            (element) => prefilledResponseData[element.id] !== undefined
          );

          if (allElementsPrefilled) {
            const prefilledTtc: TResponseTtc = {};
            block.elements.forEach((element) => {
              prefilledTtc[element.id] = 0; // 0 TTC for prefilled/skipped questions
            });
            setTtc({ ...ttc, ...prefilledTtc });

            // Auto-submit the entire block (skip to next)
            setTimeout(() => {
              onSubmit(prefilledData, prefilledTtc);
            }, 0);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once when block mounts
  }, []);

  // Validate ranking element
  const validateRankingElement = (
    element: TSurveyRankingElement,
    response: unknown,
    form: HTMLFormElement
  ): boolean => {
    const isRequired = element.required;
    const isValueArray = Array.isArray(response);
    const atLeastOneRanked = isValueArray && response.length >= 1;

    // If required: at least 1 option must be ranked
    if (isRequired && (!isValueArray || !atLeastOneRanked)) {
      form.requestSubmit();
      return false;
    }

    // If not required: allow partial ranking (some items ranked, some not)
    // No validation needed - user can proceed with any number of ranked items (including 0)

    return true;
  };

  // Check if response is empty
  const isEmptyResponse = (response: unknown): boolean => {
    return (
      response === undefined ||
      response === null ||
      response === "" ||
      (Array.isArray(response) && response.length === 0) ||
      (typeof response === "object" && !Array.isArray(response) && Object.keys(response).length === 0)
    );
  };

  const hasUnansweredRows = (responseData: TResponseDataValue, element: TSurveyMatrixElement): boolean => {
    return element.rows.some((row) => {
      const rowLabel = getLocalizedValue(row.label, languageCode);
      return !responseData?.[rowLabel as keyof typeof responseData];
    });
  };

  // Validate a single element's form
  const validateElementForm = (element: TSurveyElement, form: HTMLFormElement): boolean => {
    const response = value[element.id];

    if (
      element.type === TSurveyElementTypeEnum.Address ||
      element.type === TSurveyElementTypeEnum.ContactInfo
    ) {
      if (!form.checkValidity()) {
        form.requestSubmit();
        return false;
      }
      return true;
    }

    // Custom validation for ranking questions
    if (element.type === TSurveyElementTypeEnum.Ranking && !validateRankingElement(element, response, form)) {
      return false;
    }

    // Custom validation for matrix questions
    if (element.type === TSurveyElementTypeEnum.Matrix) {
      if (element.required && (!response || hasUnansweredRows(response, element))) {
        form.requestSubmit();
        return false;
      }
    }

    // For other element types, check if required fields are empty
    // CTA elements should not block navigation even if marked required (as they are informational)
    if (element.type !== TSurveyElementTypeEnum.CTA) {
      if (element.required && isEmptyResponse(response)) {
        form.requestSubmit();
        return false;
      }
    }

    return true;
  };

  // Find the first invalid form
  const findFirstInvalidForm = (): HTMLFormElement | null => {
    let firstInvalidForm: HTMLFormElement | null = null;

    for (const element of block.elements) {
      const form = elementFormRefs.current.get(element.id);
      if (form && !validateElementForm(element, form)) {
        if (!firstInvalidForm) {
          firstInvalidForm = form;
        }
      }
    }

    return firstInvalidForm;
  };

  // Collect TTC values from forms
  const collectTtcValues = (): TResponseTtc => {
    // Clear the TTC collector before collecting new values
    ttcCollectorRef.current = {};

    // Call each form's submit method to trigger TTC calculation
    block.elements.forEach((element) => {
      const form = elementFormRefs.current.get(element.id);
      if (form) {
        form.requestSubmit();
      }
    });

    // Collect TTC from the ref (populated synchronously by form submissions)
    const blockTtc: TResponseTtc = {};
    block.elements.forEach((element) => {
      if (ttcCollectorRef.current[element.id] !== undefined) {
        blockTtc[element.id] = ttcCollectorRef.current[element.id];
      } else if (ttc[element.id] !== undefined) {
        blockTtc[element.id] = ttc[element.id];
      }
    });

    return blockTtc;
  };

  // Collect responses for all elements in this block
  const collectBlockResponses = (): TResponseData => {
    const blockResponses: TResponseData = {};
    block.elements.forEach((element) => {
      if (value[element.id] !== undefined) {
        blockResponses[element.id] = value[element.id];
      }
    });
    return blockResponses;
  };

  const handleBlockSubmit = (e?: Event) => {
    if (e) {
      e.preventDefault();
    }

    // Run centralized validation for elements that support it
    const errorMap = validateBlockResponses(block.elements, value, languageCode, t);

    // Check if there are any validation errors from centralized validation
    const hasValidationErrors = Object.keys(errorMap).length > 0;

    if (hasValidationErrors) {
      setElementErrors(errorMap);

      // Find the first element with an error and scroll to it
      const firstErrorElementId = Object.keys(errorMap)[0];
      const form = elementFormRefs.current.get(firstErrorElementId);
      if (form) {
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Also run legacy validation for elements not yet migrated to centralized validation
    const firstInvalidForm = findFirstInvalidForm();
    if (firstInvalidForm) {
      firstInvalidForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Clear any previous errors
    setElementErrors({});

    // Collect TTC and responses, then submit
    const blockTtc = collectTtcValues();
    const blockResponses = collectBlockResponses();
    onSubmit(blockResponses, blockTtc);
  };

  return (
    <div className={cn("space-y-6", fullSizeCards ? "h-full" : "")}>
      {/* Scrollable container for the entire block */}
      <ScrollableContainer fullSizeCards={fullSizeCards}>
        <div className="space-y-6">
          <div className="space-y-6">
            {block.elements.map((element, index) => {
              const isFirstElement = index === 0;

              return (
                <div key={element.id}>
                  <ElementConditional
                    element={element}
                    value={value[element.id]}
                    onChange={(responseData) => handleElementChange(element.id, responseData)}
                    onFileUpload={onFileUpload}
                    languageCode={languageCode}
                    ttc={ttc}
                    setTtc={setTtc}
                    surveyId={surveyId}
                    autoFocusEnabled={autoFocusEnabled && isFirstElement}
                    currentElementId={currentElementId}
                    onOpenExternalURL={onOpenExternalURL}
                    dir={dir}
                    formRef={(ref) => {
                      if (ref) {
                        elementFormRefs.current.set(element.id, ref);
                      } else {
                        elementFormRefs.current.delete(element.id);
                      }
                    }}
                    onTtcCollect={handleTtcCollect}
                    errorMessage={getFirstErrorMessage(elementErrors, element.id)}
                  />
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "flex w-full flex-row-reverse justify-between",
              fullSizeCards ? "bg-survey-bg sticky bottom-0" : ""
            )}>
            <div>
              <SubmitButton
                buttonLabel={
                  block.buttonLabel ? getLocalizedValue(block.buttonLabel, languageCode) : undefined
                }
                isLastQuestion={isLastBlock}
                onClick={handleBlockSubmit}
                tabIndex={0}
              />
            </div>
            {!isFirstBlock && !isBackButtonHidden && (
              <BackButton
                backButtonLabel={
                  block.backButtonLabel ? getLocalizedValue(block.backButtonLabel, languageCode) : undefined
                }
                onClick={onBack}
                tabIndex={0}
              />
            )}
          </div>
        </div>
      </ScrollableContainer>
    </div>
  );
}
