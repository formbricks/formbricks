import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDeployTokenQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { useDeployERC20 } from "@formbricks/web3";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { ErrorCard } from "../general/error-card";
import { Headline } from "../general/headline";
import { Input } from "../general/input";
import { Label } from "../general/label";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

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
  setIsResponseSendingFinished?: (finish: boolean) => void;
}

export function DeployTokenQuestion({
  question,
  value,
  onChange,
  onSubmit,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  autoFocusEnabled,
  setIsResponseSendingFinished,
}: DeployTokenQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isDeployFailed, setIsDeployFailed] = useState<boolean>(false);

  const isDeployingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { deploy } = useDeployERC20();
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
    {
      id: "transactionDetails",
      label: "Transaction Details",
    },
  ];

  const handleChange = (fieldId: string, fieldValue: string) => {
    const newValue = fields.map((field) => {
      if (field.id === fieldId) {
        return fieldValue;
      }
      const existingValue = safeValue[fields.findIndex((f) => f.id === field.id)] || "";
      return existingValue;
    });
    onChange({ [question.id]: newValue });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    // @ts-ignore
    // Check here for token deployed first, if token deploy loading
    e.preventDefault();
    if (isDeployingRef.current) return;

    try {
      setIsDeployFailed(false);
      isDeployingRef.current = true;
      setIsDeploying(true);

      const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
      setTtc(updatedTtc);

      const deploymentResult = await deployToken();

      const txDetails = JSON.stringify({
        transactionHash: deploymentResult?.transactionHash?.hash,
        tokenAddress: deploymentResult?.tokenAddress,
      });
      const finalValue = fields.map((field) => {
        if (field.id === "transactionDetails") return txDetails;
        const index = fields.findIndex((f) => f.id === field.id);
        return safeValue[index] || "";
      });

      // Update the value
      onChange({ [question.id]: finalValue });

      onSubmit({ [question.id]: finalValue }, updatedTtc);
      if (setIsResponseSendingFinished) {
        //giving extra room for the response to be sent
        await new Promise((resolve) => setTimeout(resolve, 5000));
        setIsResponseSendingFinished(true);
      }
    } catch (error) {
      setIsDeployFailed(true);
      return;
    } finally {
      isDeployingRef.current = false;
      setIsDeploying(false);
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

  const getFieldValueById = (id: string) => {
    const index = fields.findIndex((f) => f.id === id);
    return safeValue[index];
  };

  const deployToken = async () => {
    const tokenName = getFieldValueById("tokenName");
    const tokenSymbol = getFieldValueById("tokenSymbol");
    const initialSupply = getFieldValueById("initialSupply");

    const txResp = await deploy(tokenName, tokenSymbol, initialSupply);
    return txResp;
  };

  if (isDeployFailed) {
    return <ErrorCard />;
  }

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full" ref={formRef}>
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

          <div className="mt-4 flex w-full flex-col space-y-2">
            {fields.map((field, index) => {
              let inputType = "text";
              if (field.id === "initialSupply") {
                inputType = "number";
              }

              if (field.id === "transactionDetails") {
                return;
              }

              return (
                <div key={field.id} className="space-y-1">
                  <Label text={`${field.label}*`} />
                  <Input
                    ref={index === 0 ? DeployTokenRef : null}
                    key={field.id}
                    required={true}
                    value={safeValue[index] || ""}
                    type={inputType}
                    onChange={(e) => {
                      handleChange(field.id, e.currentTarget.value);
                    }}
                    tabIndex={isCurrent ? 0 : -1}
                    aria-label={field.label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ScrollableContainer>

      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        <BackButton
          tabIndex={isCurrent ? 0 : -1}
          isLoading={isDeploying}
          backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
          onClick={() => {
            window.location.href = window.location.origin;
          }}
        />

        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          isLoading={isDeploying}
        />
      </div>
    </form>
  );
}
