import type { Survey as PrismaSurvey } from "@prisma/client";
import { Question } from "./questions";

export interface Survey extends Omit<PrismaSurvey, "questions" | "triggers"> {
  questions: Question[];
  triggers: string[];
  numDisplays: number;
  responseRate: number;
  displayOptions: "displayOnce" | "displayMultiple" | "respondMultiple";
}
