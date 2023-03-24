import { Question } from "./questions";

export interface Template {
  name: string;
  icon: any;
  description: string;
  category?: "Product Experience" | "Product Exploration" | "Growth Marketing" | "Increase Revenue";
  preset: {
    name: string;
    questions: Question[];
  };
}
