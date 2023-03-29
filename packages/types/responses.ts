import { Question } from "./questions";

export interface QuestionSummary {
  question: Question;
  responses: {
    id: string;
    value: string;
    updatedAt: string;
    personId: string;
  }[];
}
