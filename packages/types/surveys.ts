import { PlacementType } from "./js";
import { Question } from "./questions";

export interface ThankYouCard {
  enabled: boolean;
  headline?: string;
  subheader?: string;
}

export interface SurveyClosedMessage {
  heading?: string;
  subheading?: string;
}

export interface SurveySingleUse {
  enabled: boolean;
  heading?: string;
  subheading?: string;
}

export interface VerifyEmail {
  name?: string;
  subheading?: string;
}

export interface SurveyProductOverwrites {
  brandColor: string;
  highlightBorderColor: string | null;
  placement: PlacementType;
  clickOutside: boolean;
  darkOverlay: boolean;
}

export interface Survey {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  redirectUrl: string | null;
  type: "web" | "email" | "link" | "mobile";
  environmentId: string;
  status: "draft" | "inProgress" | "paused" | "completed";
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
  surveyClosedMessage: SurveyClosedMessage | null;
  verifyEmail: VerifyEmail | null;
  closeOnDate: Date | null;
  singleUse: SurveySingleUse | null;
  _count: { responses: number | null } | null;
  productOverwrites: SurveyProductOverwrites | null;
}

export interface AttributeFilter {
  attributeClassId: string;
  condition: string;
  value: string;
}

export interface SurveyNotificationData {
  id: string;
  numDisplays: number;
  numDisplaysResponded: number;
  responseLenght: number;
  responseCompletedLength: number;
  latestResponse: any;
  questions: Question[];
  status: "draft" | "inProgress" | "paused" | "completed";
  name: String;
}
