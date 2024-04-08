import { CTAQuestion } from "@/components/questions/CTAQuestion";
import { CalQuestion } from "@/components/questions/CalQuestion";
import { ConsentQuestion } from "@/components/questions/ConsentQuestion";
import { DateQuestion } from "@/components/questions/DateQuestion";
import { FileUploadQuestion } from "@/components/questions/FileUploadQuestion";
import { MatrixQuestion } from "@/components/questions/MatrixQuestion";
import { MultipleChoiceMultiQuestion } from "@/components/questions/MultipleChoiceMultiQuestion";
import { MultipleChoiceSingleQuestion } from "@/components/questions/MultipleChoiceSingleQuestion";
import { NPSQuestion } from "@/components/questions/NPSQuestion";
import { OpenTextQuestion } from "@/components/questions/OpenTextQuestion";
import { PictureSelectionQuestion } from "@/components/questions/PictureSelectionQuestion";
import { RatingQuestion } from "@/components/questions/RatingQuestion";

import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";

interface QuestionConditionalProps {
  question: TSurveyQuestion;
  value: string | number | string[] | Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  onFileUpload: (file: File, config?: TUploadFileConfig) => Promise<string>;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  surveyId: string;
  isInIframe: boolean;
}

export default function QuestionConditional({
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
  surveyId,
  onFileUpload,
  isInIframe,
}: QuestionConditionalProps) {
  return question.type === TSurveyQuestionType.OpenText ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.MultipleChoiceSingle ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.MultipleChoiceMulti ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.NPS ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.CTA ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.Rating ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.Consent ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.Date ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.PictureSelection ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.FileUpload ? (
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
      isInIframe={isInIframe}
    />
  ) : question.type === TSurveyQuestionType.Cal ? (
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
      isInIframe={isInIframe}
      setTtc={setTtc}
    />
  ) : question.type === TSurveyQuestionType.Matrix ? (
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
    />
  ) : null;
}
