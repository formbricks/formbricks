import { Question } from "./questions";

export interface ThankYouCard {
  enabled: boolean;
  headline?: string;
  subheader?: string;
}

export interface Survey {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  redirectUrl: string | null;
  type: "web" | "email" | "link" | "mobile";
  environmentId: string;
  status: "draft" | "inProgress" | "archived" | "paused" | "completed";
  recontactDays: number | null;
  questions: Question[];
  thankYouCard: ThankYouCard;
  triggers: string[];
  numDisplays: number;
  responseRate: number;
  displayOption: "displayOnce" | "displayMultiple" | "respondMultiple";
  attributeFilters: AttributeFilter[];
  autoClose: number | null;
  delay: number;
  autoComplete: number | null;
}

export interface AttributeFilter {
  attributeClassId: string;
  condition: string;
  value: string;
}
