import type { Question } from "./questions";

export interface Response {
  id: string;
  createdAt: string;
  updatedAt: string;
  finished: boolean;
  surveyId: string;
  personId?: string;
  data: {
    [questionId: string]: string;
  };
  meta: {
    [key: string]: string;
  };
  userAttributes: {}[];
}

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
