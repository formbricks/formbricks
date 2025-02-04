import { Survey } from "@prisma/client";

export interface TAISurveyCreateInput extends Pick<Survey, "name" | "questions"> {}
