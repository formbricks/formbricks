import { useEffect, useRef, useState } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { ElementConditional } from "@/components/general/element-conditional";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  // Track the current element being filled (for TTC tracking)
  const [currentElementId, setCurrentElementId] = useState(block.elements[0]?.id);

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
    onChange(responseData);
  };

  // Handler to collect TTC values synchronously (called from element form submissions)
  const handleTtcCollect = (elementId: string, elementTtc: number) => {
    ttcCollectorRef.current[elementId] = elementTtc;
  };

  // Handle skipPrefilled at block level
  useEffect(() => {
    if (skipPrefilled && prefilledResponseData) {
      // Check if ALL elements in this block have prefilled values
      const allElementsPrefilled = block.elements.every(
        (element) => prefilledResponseData[element.id] !== undefined
      );

      if (allElementsPrefilled) {
        // Auto-populate all prefilled values
        const prefilledData: TResponseData = {};
        const prefilledTtc: TResponseTtc = {};

        block.elements.forEach((element) => {
          prefilledData[element.id] = prefilledResponseData[element.id];
          prefilledTtc[element.id] = 0; // 0 TTC for prefilled/skipped questions
        });

        // Update state with prefilled data
        onChange(prefilledData);
        setTtc({ ...ttc, ...prefilledTtc });

        // Auto-submit the entire block (skip to next)
        setTimeout(() => {
          onSubmit(prefilledData, prefilledTtc);
        }, 0);
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

  // Validate a single element's form
  const validateElementForm = (element: TSurveyElement, form: HTMLFormElement): boolean => {
    // Check HTML5 validity first
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }

    const response = value[element.id];

    // Custom validation for ranking questions
    if (element.type === TSurveyElementTypeEnum.Ranking && !validateRankingElement(element, response, form)) {
      return false;
    }

    // For other element types, check if required fields are empty
    if (element.required && isEmptyResponse(response)) {
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
    <div className={cn("fb-space-y-6", fullSizeCards ? "fb-h-full" : "")}>
      {/* Scrollable container for the entire block */}
      <ScrollableContainer fullSizeCards={fullSizeCards}>
        <div className="fb-space-y-6">
          <div className="fb-space-y-6">
            {block.elements.map((element, index) => {
              const isFirstElement = index === 0;

              return (
                <div key={element.id}>
                  <ElementConditional
                    element={element}
                    value={value[element.id]}
                    onChange={(responseData) => handleElementChange(element.id, responseData)}
                    onBack={() => {}}
                    onFileUpload={onFileUpload}
                    languageCode={languageCode}
                    prefilledElementValue={prefilledResponseData?.[element.id]}
                    skipPrefilled={skipPrefilled}
                    ttc={ttc}
                    setTtc={setTtc}
                    surveyId={surveyId}
                    autoFocusEnabled={autoFocusEnabled && isFirstElement}
                    currentElementId={currentElementId}
                    isBackButtonHidden={true}
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
              "fb-flex fb-w-full fb-flex-row-reverse fb-justify-between",
              fullSizeCards ? "fb-sticky fb-bottom-0 fb-bg-white" : ""
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
