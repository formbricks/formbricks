import { TPerson } from "./v1/people";

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
}

export interface QuestionSummary<T> {
  question: T;
  responses: {
    id: string;
    value: string | number | string[];
    updatedAt: Date;
    person: TPerson | null;
  }[];
}
