import type { Survey as PrismaSurvey } from "@prisma/client";
import { Question } from "./questions";

export interface ThankYouCard {
  enabled: boolean;
  headline?: string;
  subheader?: string;
}
export interface Survey extends Omit<PrismaSurvey, "questions" | "triggers" | "thankYouCard"> {
  questions: Question[];
  thankYouCard: ThankYouCard;
  triggers: string[];
  numDisplays: number;
  responseRate: number;
  displayOptions: "displayOnce" | "displayMultiple" | "respondMultiple";
}
