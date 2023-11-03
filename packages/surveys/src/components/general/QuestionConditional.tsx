import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";
import CTAQuestion from "../questions/CTAQuestion";
import ConsentQuestion from "../questions/ConsentQuestion";
import MultipleChoiceMultiQuestion from "../questions/MultipleChoiceMultiQuestion";
import MultipleChoiceSingleQuestion from "../questions/MultipleChoiceSingleQuestion";
import NPSQuestion from "../questions/NPSQuestion";
import OpenTextQuestion from "../questions/OpenTextQuestion";
import PictureSelectionQuestion from "../questions/PictureSelectionQuestion";
import RatingQuestion from "../questions/RatingQuestion";

interface QuestionConditionalProps {
  question: TSurveyQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
}

export default function QuestionConditional({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  autoFocus = true,
}: QuestionConditionalProps) {
  return question.type === TSurveyQuestionType.OpenText ? (
    <OpenTextQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      autoFocus={autoFocus}
    />
  ) : question.type === TSurveyQuestionType.MultipleChoiceSingle ? (
    <MultipleChoiceSingleQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : question.type === TSurveyQuestionType.MultipleChoiceMulti ? (
    <MultipleChoiceMultiQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : question.type === TSurveyQuestionType.NPS ? (
    <NPSQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : question.type === TSurveyQuestionType.CTA ? (
    <CTAQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : question.type === TSurveyQuestionType.Rating ? (
    <RatingQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : question.type === TSurveyQuestionType.Consent ? (
    <ConsentQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : question.type === TSurveyQuestionType.PictureSelection ? (
    <PictureSelectionQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
    />
  ) : null;
}
