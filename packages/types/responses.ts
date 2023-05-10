import type { Question } from "./questions";

export interface QuestionSummary<T extends Question> {
  question: T;
  responses: {
    id: string;
    personId: string;
    value: string;
    updatedAt: string;
    person?: {
      attributes: {
        attributeClass: {
          name: string;
        };
        value: string;
      };
    };
  }[];
}
