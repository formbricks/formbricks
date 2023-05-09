import { Question } from "./questionTypes";

export interface Template {
  name: string;
  icon?: any;
  description: string;
  category?: "Product Experience" | "Exploration" | "Growth" | "Increase Revenue" | "Customer Success";
  preset: {
    name: string;
    questions: Question[];
    thankYouCard: {
      enabled: boolean;
      headline: string;
      subheader: string;
    };
  };
}
