import { Question } from "./questions";

export interface Template {
  name: string;
  icon: any;
  description: string;
  preset: {
    name: string;
    questions: Question[];
  };
}
