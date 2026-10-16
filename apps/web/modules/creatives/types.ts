import type { TShowConditions } from "@formbricks/types/show-conditions";
import type { TCreativeDestinationSurveyState, TCreativeStatus } from "./lib/display-status";

// UI-prototype shapes following the approved T1 model (ENG-3690): one Creative row with `content`
// and `styling` JSON validated per type. They will give way to the generated API v3 types.

export type TCreativeType = "feedback_button" | "banner";
export type TCreativeIcon = "message_square" | "message_circle" | "megaphone" | "sparkles";
export type TCreativeDevice = "desktop" | "phone";
export type TFeedbackButtonEdge = "left" | "right" | "bottom";
export type TBannerPosition = "top" | "bottom";

export type TCreativeAction = { kind: "survey"; surveyId: string | null } | { kind: "link"; url: string };

export interface TCreativeContent {
  label: string;
  icon: TCreativeIcon | null;
  message: string;
  dismissible: boolean;
}

/** Size and position, set separately for desktop and phone. */
export interface TCreativeLayout {
  edge: TFeedbackButtonEdge;
  bannerPosition: TBannerPosition;
  /** Percent along the edge: from the top for left/right, from the left for bottom. */
  offset: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
}

/** Look, shared by both devices. Colors fall back to the workspace's survey button theme. */
export interface TCreativeStyling {
  useWorkspaceTheme: boolean;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  radius: number;
  font: "inherit" | "survey";
  fontWeight: 400 | 500 | 600 | 700;
}

export interface TCreativeTargeting {
  trigger: "page_view" | "action";
  actionName: string | null;
  /** The shared Trigger Logic schema (T2 · ENG-3910, PR #9618). Null shows it on every page. */
  showConditions: TShowConditions;
  /** Null shows it to everyone who matches. */
  sharePercent: number | null;
}

export interface TCreativeDailyStat {
  day: Date;
  impressions: number;
  clicks: number;
}

export interface TCreativePageStat {
  path: string;
  impressions: number;
  clicks: number;
}

export interface TCreative {
  id: string;
  name: string;
  /** Fixed at creation. */
  type: TCreativeType;
  status: TCreativeStatus;
  archivedAt: Date | null;
  publishedAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  action: TCreativeAction;
  content: TCreativeContent;
  styling: TCreativeStyling;
  layout: Record<TCreativeDevice, TCreativeLayout>;
  targeting: TCreativeTargeting;
  createdAt: Date;
  updatedAt: Date;
  creatorName: string | null;
  daily: TCreativeDailyStat[];
  pages: TCreativePageStat[];
}

export interface TCreativeSurveyOption {
  id: string;
  name: string;
  type: "app" | "link";
  status: TCreativeDestinationSurveyState["status"];
}
