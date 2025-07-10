import { AddressQuestion } from "@/components/questions/address-question";
import { CalQuestion } from "@/components/questions/cal-question";
import { ConsentQuestion } from "@/components/questions/consent-question";
import { ContactInfoQuestion } from "@/components/questions/contact-info-question";
import { CTAQuestion } from "@/components/questions/cta-question";
import { DateQuestion } from "@/components/questions/date-question";
import { FileUploadQuestion } from "@/components/questions/file-upload-question";
import { MatrixQuestion } from "@/components/questions/matrix-question";
import { MultipleChoiceMultiQuestion } from "@/components/questions/multiple-choice-multi-question";
import { MultipleChoiceSingleQuestion } from "@/components/questions/multiple-choice-single-question";
import { NPSQuestion } from "@/components/questions/nps-question";
import { OpenTextQuestion } from "@/components/questions/open-text-question";
import { PaymentQuestion } from "@/components/questions/payment-question";
import { PictureSelectionQuestion } from "@/components/questions/picture-selection-question";
import { RankingQuestion } from "@/components/questions/ranking-question";
import { RatingQuestion } from "@/components/questions/rating-question";
import { getLocalizedValue } from "@/lib/i18n";
import { useEffect } from "react";
import { type TJsFileUploadParams } from "@formbricks/types/js";
import { type TResponseData, type TResponseDataValue, type TResponseTtc } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import {
  type TSurveyQuestion,
  type TSurveyQuestionChoice,
  type TSurveyQuestionId,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

interface QuestionConditionalProps {
  question: TSurveyQuestion;
  value: string | number | string[] | Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  prefilledQuestionValue?: TResponseDataValue;
  skipPrefilled?: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  surveyId: string;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
}

export function QuestionConditional({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  prefilledQuestionValue,
  skipPrefilled,
  ttc,
  setTtc,
  surveyId,
  onFileUpload,
  autoFocusEnabled,
  currentQuestionId,
  isBackButtonHidden,
  onOpenExternalURL,
}: QuestionConditionalProps) {
  const getResponseValueForRankingQuestion = (
    value: string[],
    choices: TSurveyQuestionChoice[]
  ): string[] => {
    return value
      .map((label) => choices.find((choice) => getLocalizedValue(choice.label, languageCode) === label)?.id)
      .filter((id): id is TSurveyQuestionChoice["id"] => id !== undefined);
  };

  useEffect(() => {
    if (value === undefined && (prefilledQuestionValue || prefilledQuestionValue === "")) {
      if (skipPrefilled) {
        onSubmit({ [question.id]: prefilledQuestionValue }, { [question.id]: 0 });
      } else {
        onChange({ [question.id]: prefilledQuestionValue });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we want to run this only once when the question renders for the first time
  }, []);

  return question.type === TSurveyQuestionTypeEnum.OpenText ? (
    <OpenTextQuestion
      key={question.id}
      question={question}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ? (
    <MultipleChoiceSingleQuestion
      key={question.id}
      question={question}
      value={typeof value === "string" ? value : undefined}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ? (
    <MultipleChoiceMultiQuestion
      key={question.id}
      question={question}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.NPS ? (
    <NPSQuestion
      key={question.id}
      question={question}
      value={typeof value === "number" ? value : undefined}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.CTA ? (
    <CTAQuestion
      key={question.id}
      question={question}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
      onOpenExternalURL={onOpenExternalURL}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Rating ? (
    <RatingQuestion
      key={question.id}
      question={question}
      value={typeof value === "number" ? value : undefined}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Consent ? (
    <ConsentQuestion
      key={question.id}
      question={question}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Date ? (
    <DateQuestion
      key={question.id}
      question={question}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.PictureSelection ? (
    <PictureSelectionQuestion
      key={question.id}
      question={question}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.FileUpload ? (
    <FileUploadQuestion
      key={question.id}
      surveyId={surveyId}
      question={question}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      onFileUpload={onFileUpload}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Cal ? (
    <CalQuestion
      key={question.id}
      question={question}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      autoFocusEnabled={autoFocusEnabled}
      setTtc={setTtc}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Matrix ? (
    <MatrixQuestion
      question={question}
      value={typeof value === "object" && !Array.isArray(value) ? value : {}}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Address ? (
    <AddressQuestion
      question={question}
      value={Array.isArray(value) ? value : undefined}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      currentQuestionId={currentQuestionId}
      autoFocusEnabled={autoFocusEnabled}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Ranking ? (
    <RankingQuestion
      question={question}
      value={Array.isArray(value) ? getResponseValueForRankingQuestion(value, question.choices) : []}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      autoFocusEnabled={autoFocusEnabled}
      currentQuestionId={currentQuestionId}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.ContactInfo ? (
    <ContactInfoQuestion
      question={question}
      value={Array.isArray(value) ? value : undefined}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      currentQuestionId={currentQuestionId}
      autoFocusEnabled={autoFocusEnabled}
      isBackButtonHidden={isBackButtonHidden}
    />
  ) : question.type === TSurveyQuestionTypeEnum.Payment ? (
    <PaymentQuestion
      question={question}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      languageCode={languageCode}
      ttc={ttc}
      setTtc={setTtc}
      currentQuestionId={currentQuestionId}
      autoFocusEnabled={autoFocusEnabled}
      isBackButtonHidden={isBackButtonHidden}
      environmentId=""
      surveyId={surveyId}
      stripePublishableKey=""
    />
  ) : null;
}
