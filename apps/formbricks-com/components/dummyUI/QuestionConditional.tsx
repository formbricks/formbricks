import { QuestionType, type Question } from "@formbricks/types/questions";
import OpenTextQuestion from "./OpenTextQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import MultipleChoiceMultiQuestion from "./MultipleChoiceMultiQuestion";
import NPSQuestion from "./NPSQuestion";
import CTAQuestion from "./CTAQuestion";
import { BookingwithCal } from "./BookingwithCalQuestion";
import RatingQuestion from "./RatingQuestion";

interface QuestionConditionalProps {
  question: Question;
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
  return question.type === QuestionType.OpenText ? (
    <OpenTextQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.MultipleChoiceSingle ? (
    <MultipleChoiceSingleQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.MultipleChoiceMulti ? (
    <MultipleChoiceMultiQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.NPS ? (
    <NPSQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.CTA ? (
    <CTAQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === QuestionType.BookingwithCal ? (
    <BookingwithCalQuestion
      question={question}
      onSubmit
    />
  ) : question.type === QuestionType.Rating ? (
    <RatingQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : null;
}
