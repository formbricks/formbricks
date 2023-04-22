import { Question } from "./questionTypes";

export interface Template {
  name: string;
  icon: any;
  description: string;
  category?: "All" | "Product Management" | "Growth Marketing" | "Increase Revenue";
  preset: {
    name: string;
    questions: Question[];
  };
}
