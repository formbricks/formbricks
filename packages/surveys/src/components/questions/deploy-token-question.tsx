import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDeployTokenQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
interface DeployTokenQuestionProps {
  question: TSurveyDeployTokenQuestion;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: TSurveyQuestionId;
  autoFocusEnabled: boolean;
  isBackButtonHidden: boolean;
}

export function DeployTokenQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  autoFocusEnabled,
  isBackButtonHidden,
}: DeployTokenQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const isCurrent = question.id === currentQuestionId;
  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", ""];
  }, [value]);

  const fields = [
    {
      id: "tokenName",
      ...question.tokenName,
      label: question.tokenName.placeholder[languageCode],
    },
    {
      id: "tokenSymbol",
      ...question.tokenSymbol,
      label: question.tokenSymbol.placeholder[languageCode],
    },
    {
      id: "initialSupply",
      ...question.initialSupply,
      label: question.initialSupply.placeholder[languageCode],
    },
  ];

  const handleChange = (fieldId: string, fieldValue: string) => {
    const newValue = fields.map((field) => {
      if (field.id === fieldId) {
        return fieldValue;
      }
      const existingValue = safeValue[fields.findIndex((f) => f.id === field.id)] || "";
      return field.show ? existingValue : "";
    });
    onChange({ [question.id]: newValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    const containsAllEmptyStrings = safeValue.length === 5 && safeValue.every((item) => item.trim() === "");
    if (containsAllEmptyStrings) {
      onSubmit({ [question.id]: [] }, updatedTtc);
    } else {
      onSubmit({ [question.id]: safeValue }, updatedTtc);
    }
  };

  const DeployTokenRef = useCallback(
    (currentElement: HTMLInputElement | null) => {
      // will focus on current element when the question ID matches the current question
      if (question.id && currentElement && autoFocusEnabled && question.id === currentQuestionId) {
        currentElement.focus();
      }
    },
    [question.id, autoFocusEnabled, currentQuestionId]
  );

  const triggerDeploy = (tokenName: string, tokenSymbol: string, initialSupply: number) => {
    const deployEvent = new CustomEvent("deployWalletAction", {
      detail: { tokenName, tokenSymbol, initialSupply },
    });
  
    window.dispatchEvent(deployEvent);
  };

  const getFieldValueById = (id: string) => {
    const index = fields.findIndex((f) => f.id === id);
    return fields[index]?.show ? safeValue[index] : "";
  };

  return (
    <form key={question.id} onSubmit={handleSubmit} className="fb-w-full" ref={formRef}>
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />

          <div className="fb-flex fb-flex-col fb-space-y-2 fb-mt-4 fb-w-full">
            {fields.map((field, index) => {
              const isFieldRequired = () => {
                if (field.required) {
                  return true;
                }

                // if all fields are optional and the question is required, then the fields should be required
                if (
                  fields.filter((currField) => currField.show).every((currField) => !currField.required) &&
                  question.required
                ) {
                  return true;
                }

                return false;
              };

              let inputType = "text";
              if (field.id === "initialSupply") {
                inputType = "number";
              }

              return (
                field.show && (
                  <div className="fb-space-y-1">
                    <Label text={isFieldRequired() ? `${field.label}*` : field.label} />
                    <Input
                      ref={index === 0 ? DeployTokenRef : null}
                      key={field.id}
                      required={isFieldRequired()}
                      value={safeValue[index] || ""}
                      type={inputType}
                      onChange={(e) => {
                        handleChange(field.id, e.currentTarget.value);
                      }}
                      tabIndex={isCurrent ? 0 : -1}
                      aria-label={field.label}
                    />
                  </div>
                )
              );
            })}
          </div>
        </div>
      </ScrollableContainer>

      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
        <button
          onClick={() => {
            const tokenName = getFieldValueById("tokenName");
            const tokenSymbol = getFieldValueById("tokenSymbol");
            const initialSupply = Number(getFieldValueById("initialSupply"));
        
            triggerDeploy(tokenName, tokenSymbol, initialSupply);
          }}
          className="fb-bg-brand fb-border-submit-button-border fb-text-on-brand focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
        >
          Deploy
        </button>
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
      </div>
    </form>
  );
}
