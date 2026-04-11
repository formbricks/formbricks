import { useEffect, useRef, useState } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyMatrixElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { ElementConditional } from "@/components/general/element-conditional";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Element types that trigger auto-advance when answered
const AUTO_ADVANCE_ELIGIBLE_TYPES = new Set([
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.PictureSelection,
  TSurveyElementTypeEnum.Cal,
]);

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
  cardSize?: "normal" | "tall";
  autoAdvance?: boolean;
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
  cardSize,
  autoAdvance,
}: BlockConditionalProps) {
  // Track the current element being filled (for TTC tracking)
  const [currentElementId, setCurrentElementId] = useState(block.elements[0]?.id);

  // Refs to store form elements for each element so we can trigger their validation
  const elementFormRefs = useRef<Map<string, HTMLFormElement>>(new Map());

  // Ref to collect TTC values synchronously (state updates are async)
  const ttcCollectorRef = useRef<TResponseTtc>({});

  // Ref to track pending auto-submit timeout so we can cancel if needed
  const autoSubmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up auto-submit timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, []);

  // Handle change for an individual element
  const handleElementChange = (elementId: string, responseData: TResponseData) => {
    // If user moved to a different element, we should track it
    if (elementId !== currentElementId) {
      setCurrentElementId(elementId);
    }
    // Merge with existing block data to preserve other element values
    const mergedData = { ...value, ...responseData };
    onChange(mergedData);

    // Auto-advance logic
    if (autoAdvance) {
      const element = block.elements.find((el) => el.id === elementId);
      if (element && AUTO_ADVANCE_ELIGIBLE_TYPES.has(element.type)) {
        // For picture selection, only auto-advance if it's single-select mode
        if (
          element.type === TSurveyElementTypeEnum.PictureSelection &&
          "allowMulti" in element &&
          element.allowMulti
        ) {
          return;
        }

        // If multi-element block, scroll to next unanswered element
        if (block.elements.length > 1) {
          const elementIndex = block.elements.findIndex((el) => el.id === elementId);
          const nextElement = block.elements[elementIndex + 1];

          if (nextElement) {
            setTimeout(() => {
              const nextElementDom = document.getElementById(`element-${nextElement.id}`);
              if (nextElementDom) {
                nextElementDom.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 100);
          }
        }

        // Check if all elements now have values → auto-submit
        const allAnswered = block.elements.every((el) => {
          const val = el.id === elementId ? responseData[el.id] : mergedData[el.id];
          return val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0);
        });

        if (allAnswered) {
          // Clear any previous pending auto-submit
          if (autoSubmitTimeoutRef.current) {
            clearTimeout(autoSubmitTimeoutRef.current);
          }
          // Build block responses now from mergedData to avoid stale closure on `value`
          const blockResponses: TResponseData = {};
          block.elements.forEach((el) => {
            const val = el.id === elementId ? responseData[el.id] : mergedData[el.id];
            if (val !== undefined) {
              blockResponses[el.id] = val;
            }
          });
          autoSubmitTimeoutRef.current = setTimeout(() => {
            const blockTtc = collectTtcValues();
            onSubmit(blockResponses, blockTtc);
          }, 600);
        }
      }
    }
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
    const rankingElement = element;
    const hasIncompleteRanking =
      (rankingElement.required &&
        (!Array.isArray(response) || response.length !== rankingElement.choices.length)) ||
      (!rankingElement.required &&
        Array.isArray(response) &&
        response.length > 0 &&
        response.length < rankingElement.choices.length);

    if (hasIncompleteRanking) {
      form.requestSubmit();
      return false;
    }
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

    if (element.type === TSurveyElementTypeEnum.Address) {
      if (!form.checkValidity()) {
        form.requestSubmit();
        return false;
      }
      return true;
    }

    if (element.type === TSurveyElementTypeEnum.ContactInfo) {
      if (!form.checkValidity()) {
        form.requestSubmit();
        return false;
      }
      // Validate required dropdown custom fields (not native inputs, so checkValidity misses them)
      const customFields = (element as any).customFields ?? [];
      const responseObj = (typeof response === "object" && !Array.isArray(response) ? response : {}) as Record<string, string>;
      for (const cf of customFields) {
        if (cf.show && cf.required && cf.type === "dropdown") {
          if (!responseObj[cf.id] || responseObj[cf.id].trim() === "") {
            return false;
          }
        }
      }
      return true;
    }

    // Custom validation for ranking questions
    if (element.type === TSurveyElementTypeEnum.Ranking && !validateRankingElement(element, response, form)) {
      return false;
    }

    if (
      element.type === TSurveyElementTypeEnum.Matrix &&
      element.required &&
      response &&
      hasUnansweredRows(response, element)
    ) {
      form.requestSubmit();
      return false;
    }

    // For other element types, check if required fields are empty
    // CTA elements should not block navigation even if marked required (as they are informational)
    if (element.type !== TSurveyElementTypeEnum.CTA && element.required && isEmptyResponse(response)) {
      form.requestSubmit();
      return false;
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

    // Validate all forms and check for custom validation rules
    const firstInvalidForm = findFirstInvalidForm();

    // If any form is invalid, scroll to it and stop
    if (firstInvalidForm) {
      firstInvalidForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Collect TTC and responses, then submit
    const blockTtc = collectTtcValues();
    const blockResponses = collectBlockResponses();
    onSubmit(blockResponses, blockTtc);
  };

  return (
    <div className={cn("space-y-6", fullSizeCards ? "h-full" : "")}>
      {/* Scrollable container for the entire block */}
      <ScrollableContainer fullSizeCards={fullSizeCards} cardSize={cardSize}>
        <div className="space-y-6">
          <div className="space-y-6">
            {block.elements.map((element, index) => {
              const isFirstElement = index === 0;

              return (
                <div key={element.id} id={`element-${element.id}`}>
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
