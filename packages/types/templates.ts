import { Question } from "./questions";

export type Objective =
  | "increase_user_adoption"
  | "increase_conversion"
  | "support_sales"
  | "sharpen_marketing_messaging"
  | "improve_user_retention"
  | "other";

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
