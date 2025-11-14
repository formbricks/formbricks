import { useRef, useState } from "preact/hooks";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { ElementConditional } from "@/components/general/element-conditional";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface BlockConditionalProps {
  // survey: TJsEnvironmentStateSurvey;
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
  currentBlockId: string;
  isBackButtonHidden: boolean;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  dir?: "ltr" | "rtl" | "auto";
  fullSizeCards: boolean;
}

export function BlockConditional({
  // survey,
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

  const hasCTAElement = block.elements.some((element) => element.type === TSurveyElementTypeEnum.CTA);

  // Handle change for an individual element
  const handleElementChange = (elementId: string, responseData: TResponseData) => {
    // If user moved to a different element, we should track it
    if (elementId !== currentElementId) {
      setCurrentElementId(elementId);
    }
    onChange(responseData);
  };

  const handleBlockSubmit = (e?: Event) => {
    if (e) {
      e.preventDefault();
    }

    // Validate all forms and check for custom validation rules
    let firstInvalidForm: HTMLFormElement | null = null;

    for (const element of block.elements) {
      const form = elementFormRefs.current.get(element.id);
      if (form) {
        // Check HTML5 validity first
        if (!form.checkValidity()) {
          if (!firstInvalidForm) {
            firstInvalidForm = form;
          }
          form.reportValidity();
          continue;
        }

        // Custom validation for ranking questions
        if (element.type === TSurveyElementTypeEnum.Ranking) {
          const response = value[element.id];
          const rankingElement = element;

          // Check if ranking is incomplete
          const hasIncompleteRanking =
            (rankingElement.required &&
              (!Array.isArray(response) || response.length !== rankingElement.choices.length)) ||
            (!rankingElement.required &&
              Array.isArray(response) &&
              response.length > 0 &&
              response.length < rankingElement.choices.length);

          if (hasIncompleteRanking) {
            // Trigger the ranking form's submit to show the error message
            form.requestSubmit();
            if (!firstInvalidForm) {
              firstInvalidForm = form;
            }
            continue;
          }
        }

        // For other element types, check if required fields are empty
        if (element.required) {
          const response = value[element.id];
          const isEmpty =
            response === undefined ||
            response === null ||
            response === "" ||
            (Array.isArray(response) && response.length === 0) ||
            (typeof response === "object" && !Array.isArray(response) && Object.keys(response).length === 0);

          if (isEmpty) {
            form.requestSubmit();
            if (!firstInvalidForm) {
              firstInvalidForm = form;
            }
            continue;
          }
        }
      }
    }

    // If any form is invalid, scroll to it and stop
    if (firstInvalidForm) {
      firstInvalidForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // All validations passed - collect TTC for all elements in this block
    const blockTtc: TResponseTtc = {};
    block.elements.forEach((element) => {
      if (ttc[element.id] !== undefined) {
        blockTtc[element.id] = ttc[element.id];
      }
    });

    // Collect responses for all elements in this block
    const blockResponses: TResponseData = {};
    block.elements.forEach((element) => {
      if (value[element.id] !== undefined) {
        blockResponses[element.id] = value[element.id];
      }
    });

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
                    onSubmit={hasCTAElement ? onSubmit : () => {}}
                    onBack={hasCTAElement ? onBack : () => {}}
                    onFileUpload={onFileUpload}
                    isFirstElement={hasCTAElement ? isFirstBlock : false}
                    isLastElement={hasCTAElement ? isLastBlock : false}
                    languageCode={languageCode}
                    prefilledElementValue={prefilledResponseData?.[element.id]}
                    skipPrefilled={skipPrefilled}
                    ttc={ttc}
                    setTtc={setTtc}
                    surveyId={surveyId}
                    autoFocusEnabled={autoFocusEnabled && isFirstElement}
                    currentElementId={currentElementId}
                    isBackButtonHidden={hasCTAElement ? isBackButtonHidden : true}
                    onOpenExternalURL={onOpenExternalURL}
                    dir={dir}
                    fullSizeCards={false} // Individual elements within block shouldn't be full size
                    formRef={(ref) => {
                      if (ref) {
                        elementFormRefs.current.set(element.id, ref);
                      } else {
                        elementFormRefs.current.delete(element.id);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>

          {!hasCTAElement && (
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
          )}
        </div>
      </ScrollableContainer>
    </div>
  );
}
