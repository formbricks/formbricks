import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDeployTokenQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { useDeployERC20 } from "@formbricks/web3";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { Input } from "../general/input";
import { Label } from "../general/label";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";
import { useUser } from "@account-kit/react";
import { LoginButton } from "@formbricks/web3/src/alchemy-wallet/components/LoginButton";

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
  const { deploy } = useDeployERC20();
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const isCurrent = question.id === currentQuestionId;
  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", ""];
  }, [value]);
  const user = useUser();

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
      id: "address",
      label: "Address",
    },
    {
      id: "transactionDetails",
      label: "Transaction Details",
    },
  ];

  useEffect(()=> {
    if(!user || !user.address){
      return;
    }
    handleChange("address", user.address);
  },[user, user?.address])

  const handleChange = (fieldId: string, fieldValue: string) => {
    console.log("Handle Change",fieldId, fieldValue)
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
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    
    const txResp = await deployToken();
    const txDetails = JSON.stringify(txResp);
    const finalValue = fields.map((field) => {
      if (field.id === "transactionDetails") return txDetails;
      const index = fields.findIndex((f) => f.id === field.id);
      return safeValue[index] || "";
    });
  
    // Update the value
    onChange({ [question.id]: finalValue });
    console.log("TX RESP",txResp);
    console.log("Stringified Json", JSON.stringify(txResp))

    // if (containsAllEmptyStrings) {
    //   onSubmit({ [question.id]: [] }, updatedTtc);
    // } else {
    //   onSubmit({ [question.id]: safeValue }, updatedTtc);
    // }
    onSubmit({ [question.id]: finalValue }, updatedTtc);
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
    console.log("Fields",fields)
  
    const txResp = await deploy(tokenName, tokenSymbol, initialSupply);
    return txResp;
  }

  console.log("Fields", fields, safeValue)
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

              if (field.id === "transactionDetails"){
                return;
              }

              if (field.id === "address"){
                return (
                  <div key={field.id} className="space-y-1">
                  <Label text={`${field.label}`} />
                    <Input
                      ref={index === 0 ? DeployTokenRef : null}
                      key={field.id}
                      required={true}
                      value={user?.address}
                      type={inputType}
                      disabled
                      tabIndex={isCurrent ? 0 : -1}
                      aria-label={field.label}
                    />
                {safeValue.map((val, index) => <div key={index}>{val}</div>)}
                </div>
                )
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
        { 
          user && user.address ?
            <SubmitButton
              tabIndex={isCurrent ? 0 : -1}
              buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
              isLastQuestion={isLastQuestion}
            />
            :
            <LoginButton />
          }
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
