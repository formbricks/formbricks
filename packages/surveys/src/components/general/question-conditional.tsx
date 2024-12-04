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
import { PictureSelectionQuestion } from "@/components/questions/picture-selection-question";
import { RankingQuestion } from "@/components/questions/ranking-question";
import { RatingQuestion } from "@/components/questions/rating-question";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
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
}: QuestionConditionalProps) {
  const getResponseValueForRankingQuestion = (val: string[], choices: TSurveyQuestionChoice[]): string[] => {
    return val
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

  if (question.type === TSurveyQuestionTypeEnum.OpenText) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.NPS) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.CTA) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Rating) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Consent) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Date) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.PictureSelection) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.FileUpload) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Cal) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Matrix) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Address) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.Ranking) {
    return (
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
    );
  } else if (question.type === TSurveyQuestionTypeEnum.ContactInfo) {
    return (
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
    );
  } else return null;
}
