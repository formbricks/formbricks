import { Question } from "./questions";

export type Objective =
  | "Improve adoption"
  | "Increase conversion"
  | "Support sales"
  | "Sharpen messaging"
  | "Increase retention";

export interface Template {
  name: string;
  icon: any;
  description: string;
  category?: "Product Experience" | "Exploration" | "Growth" | "Increase Revenue" | "Customer Success";
  objectives?: [Objective, Objective?, Objective?];
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
