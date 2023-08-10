import { QuestionType } from "../../../types/questions";
import { TSurveyQuestion } from "../../../types/v1/surveys";
import CTAQuestion from "./CTAQuestion";
import ConsentQuestion from "./ConsentQuestion";
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
  ) : null;
}
