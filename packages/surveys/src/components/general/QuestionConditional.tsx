import { AddressQuestion } from "@/components/questions/AddressQuestion";
import { CTAQuestion } from "@/components/questions/CTAQuestion";
import { CalQuestion } from "@/components/questions/CalQuestion";
import { ConsentQuestion } from "@/components/questions/ConsentQuestion";
import { ContactInfoQuestion } from "@/components/questions/ContactInfoQuestion";
import { DateQuestion } from "@/components/questions/DateQuestion";
import { FileUploadQuestion } from "@/components/questions/FileUploadQuestion";
import { MatrixQuestion } from "@/components/questions/MatrixQuestion";
import { MultipleChoiceMultiQuestion } from "@/components/questions/MultipleChoiceMultiQuestion";
import { MultipleChoiceSingleQuestion } from "@/components/questions/MultipleChoiceSingleQuestion";
import { NPSQuestion } from "@/components/questions/NPSQuestion";
import { OpenTextQuestion } from "@/components/questions/OpenTextQuestion";
import { PictureSelectionQuestion } from "@/components/questions/PictureSelectionQuestion";
import { RankingQuestion } from "@/components/questions/RankingQuestion";
import { RatingQuestion } from "@/components/questions/RatingQuestion";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TJsFileUploadParams } from "@formbricks/types/js";
import { TResponseData, TResponseDataValue, TResponseTtc } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import {
  TSurveyQuestion,
  TSurveyQuestionChoice,
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
  currentQuestionId: string;
}

export const QuestionConditional = ({
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
}: QuestionConditionalProps) => {
  const getResponseValueForRankingQuestion = (
    value: string[],
    choices: TSurveyQuestionChoice[]
  ): string[] => {
    return value
      .map((label) => choices.find((choice) => getLocalizedValue(choice.label, languageCode) === label)?.id)
      .filter((id): id is TSurveyQuestionChoice["id"] => id !== undefined);
  };

  if (!value && (prefilledQuestionValue || prefilledQuestionValue === "")) {
    if (skipPrefilled) {
      onSubmit({ [question.id]: prefilledQuestionValue }, { [question.id]: 0 });
    } else {
      onChange({ [question.id]: prefilledQuestionValue });
    }
  }

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
    />
  ) : null;
};
