import type { Survey as PrismaSurvey } from "@prisma/client";
import { Question } from "./questions";

export interface Survey extends Omit<PrismaSurvey, "questions" | "triggers"> {
  questions: Question[];
  triggers: string[];
  responseRate: number;
}
