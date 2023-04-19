import { h } from "preact";
import type { Question } from "@formbricks/types/js";
import OpenTextQuestion from "./OpenTextQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import MultipleChoiceMultiQuestion from "./MultipleChoiceMultiQuestion";
import NPSQuestion from "./NPSQuestion";

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
  return question.type === "openText" ? (
    <OpenTextQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === "multipleChoiceSingle" ? (
    <MultipleChoiceSingleQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === "multipleChoiceMulti" ? (
    <MultipleChoiceMultiQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : question.type === "nps" ? (
    <NPSQuestion
      question={question}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : null;
}
