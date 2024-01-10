import { TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";

import CTAQuestion from "./CTAQuestion";
import MultipleChoiceMultiQuestion from "./MultipleChoiceMultiQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import NPSQuestion from "./NPSQuestion";
import OpenTextQuestion from "./OpenTextQuestion";
import RatingQuestion from "./RatingQuestion";

interface QuestionConditionalProps {
  question: TSurveyQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function QuestionConditional({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: QuestionConditionalProps) {
  return question.type === TSurveyQuestionType.OpenText ? (
    <OpenTextQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === TSurveyQuestionType.MultipleChoiceSingle ? (
    <MultipleChoiceSingleQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === TSurveyQuestionType.MultipleChoiceMulti ? (
    <MultipleChoiceMultiQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === TSurveyQuestionType.NPS ? (
    <NPSQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === TSurveyQuestionType.CTA ? (
    <CTAQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === TSurveyQuestionType.Rating ? (
    <RatingQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : null;
}
