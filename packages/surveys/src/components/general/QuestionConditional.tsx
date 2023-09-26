import { QuestionType } from "@formbricks/types/questions";
import { TResponseData } from "@formbricks/types/v1/responses";
import { TSurveyQuestion } from "@formbricks/types/v1/surveys";
import CTAQuestion from "../questions/CTAQuestion";
import ConsentQuestion from "../questions/ConsentQuestion";
import MultipleChoiceMultiQuestion from "../questions/MultipleChoiceMultiQuestion";
import MultipleChoiceSingleQuestion from "../questions/MultipleChoiceSingleQuestion";
import NPSQuestion from "../questions/NPSQuestion";
import OpenTextQuestion from "../questions/OpenTextQuestion";
import RatingQuestion from "../questions/RatingQuestion";

interface QuestionConditionalProps {
  question: TSurveyQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
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
  brandColor,
  autoFocus = true,
}: QuestionConditionalProps) {
  return question.type === QuestionType.OpenText ? (
    <OpenTextQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
      autoFocus={autoFocus}
    />
  ) : question.type === QuestionType.MultipleChoiceSingle ? (
    <MultipleChoiceSingleQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.MultipleChoiceMulti ? (
    <MultipleChoiceMultiQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.NPS ? (
    <NPSQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.CTA ? (
    <CTAQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.Rating ? (
    <RatingQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === "consent" ? (
    <ConsentQuestion
      question={question}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onBack={onBack}
      isFirstQuestion={isFirstQuestion}
      isLastQuestion={isLastQuestion}
      brandColor={brandColor}
    />
  ) : null;
}
