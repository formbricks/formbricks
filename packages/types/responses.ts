import { Question } from "./questions";

export interface QuestionSummary {
  question: Question;
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
