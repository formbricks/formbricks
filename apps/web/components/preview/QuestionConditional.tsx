import type { Question } from "@formbricks/types/questions";
import OpenTextQuestion from "./OpenTextQuestion";
import MultipleChoiceSingleQuestion from "./MultipleChoiceSingleQuestion";
import MultipleChoiceMultiQuestion from "./MultipleChoiceMultiQuestion";

interface QuestionConditionalProps {
  currentQuestion: Question;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function QuestionConditional({
  currentQuestion,
  onSubmit,
  lastQuestion,
  brandColor,
}: QuestionConditionalProps) {
  return currentQuestion.type === "openText" ? (
    <OpenTextQuestion
      question={currentQuestion}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : currentQuestion.type === "multipleChoiceSingle" ? (
    <MultipleChoiceSingleQuestion
      question={currentQuestion}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : currentQuestion.type === "multipleChoiceMulti" ? (
    <MultipleChoiceMultiQuestion
      question={currentQuestion}
      onSubmit={onSubmit}
      lastQuestion={lastQuestion}
      brandColor={brandColor}
    />
  ) : null;
}
