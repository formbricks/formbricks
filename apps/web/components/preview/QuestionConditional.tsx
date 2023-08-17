import { QuestionType, type Question } from "@formbricks/types/questions";
import OpenTextQuestion from "./OpenTextQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import MultipleChoiceMultiQuestion from "./MultipleChoiceMultiQuestion";
import NPSQuestion from "./NPSQuestion";
import CTAQuestion from "./CTAQuestion";
import RatingQuestion from "./RatingQuestion";
import ConsentQuestion from "./ConsentQuestion";
import BookingWithCal from "./BookingWithCal";
import { TSurveyQuestion } from "@formbricks/types/v1/surveys";

interface QuestionConditionalProps {
  question: Question | TSurveyQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: any;
  goToNextQuestion: (answer: any) => void;
  goToPreviousQuestion?: (answer: any) => void;
  autoFocus: boolean;
}

export default function QuestionConditional({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
  autoFocus,
}: QuestionConditionalProps) {
  return question.type === QuestionType.OpenText ? (
    <OpenTextQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
      autoFocus={autoFocus}
    />
  ) : question.type === QuestionType.MultipleChoiceSingle ? (
    <MultipleChoiceSingleQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
    />
  ) : question.type === QuestionType.MultipleChoiceMulti ? (
    <MultipleChoiceMultiQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
    />
  ) : question.type === QuestionType.NPS ? (
    <NPSQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
    />
  ) : question.type === QuestionType.CTA ? (
    <CTAQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
    />
  ) : question.type === QuestionType.Rating ? (
    <RatingQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
    />
  ) : question.type === "consent" ? (
    <ConsentQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
      storedResponseValue={storedResponseValue}
      goToNextQuestion={goToNextQuestion}
      goToPreviousQuestion={goToPreviousQuestion}
    />
    ) : question.type === "cal" ? (
      <BookingWithCal
        question={question}
        onSubmit={onSubmit}
        lastQuestion={lastQuestion}
        brandColor={brandColor}
        storedResponseValue={storedResponseValue}
        goToNextQuestion={goToNextQuestion}
        goToPreviousQuestion={goToPreviousQuestion}
      />
    ) : null;
}
