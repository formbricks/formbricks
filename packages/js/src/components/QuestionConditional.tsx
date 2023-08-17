import { h } from "preact";
import { QuestionType } from "../../../types/questions";
import { TSurveyQuestion } from "../../../types/v1/surveys";
import OpenTextQuestion from "./OpenTextQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import MultipleChoiceMultiQuestion from "./MultipleChoiceMultiQuestion";
import NPSQuestion from "./NPSQuestion";
import CTAQuestion from "./CTAQuestion";
import RatingQuestion from "./RatingQuestion";
import ConsentQuestion from "./ConsentQuestion";
import BookingWithCal from "./BookingWithCal";

interface QuestionConditionalProps {
  question: TSurveyQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: any;
  goToNextQuestion: (answer: any) => void;
  goToPreviousQuestion?: (answer: any) => void;
}

export default function QuestionConditional({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
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
