// MOCK DATA for the Creatives UI prototype (backlog TASK-005). There is no table, API or SDK behind
// these pages yet: everything below is invented, and every action on the pages only changes local
// state. Replace with the API v3 Creatives resource once the data model (T1) and API (T5) land.
import type { TShowConditions } from "@formbricks/types/show-conditions";
import { type TCreativeDisplayState, getCreativeDisplayState } from "../lib/display-status";
import type {
  TCreative,
  TCreativeDailyStat,
  TCreativeLayout,
  TCreativeStyling,
  TCreativeSurveyOption,
  TCreativeType,
} from "../types";

const DAY_MS = 86_400_000;

const daysFromNow = (days: number, hours = 9): Date => {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setHours(hours, 0, 0, 0);
  return date;
};

/** A smooth, deterministic series so the summary chart looks like traffic without randomness. */
const buildDaily = (days: number, base: number, rate: number): TCreativeDailyStat[] =>
  Array.from({ length: days }, (_, index) => {
    const wave = 1 + 0.18 * Math.sin(index / 2.3) + 0.07 * Math.cos(index * 1.7);
    const impressions = Math.round(base * wave);
    return {
      day: daysFromNow(index - days + 1, 0),
      impressions,
      clicks: Math.round(impressions * rate * (1 + 0.1 * Math.sin(index))),
    };
  });

export const MOCK_SURVEYS: TCreativeSurveyOption[] = [
  { id: "srv_site_feedback", name: "Site feedback", type: "app", status: "inProgress" },
  { id: "srv_exit", name: "Exit survey", type: "app", status: "paused" },
  { id: "srv_plan_finder", name: "Plan finder check-in", type: "link", status: "inProgress" },
];

export const MOCK_ACTIONS = ["Clicked “Compare plans”", "Opened pricing", "Started checkout"];

/** Stand-in for the workspace's survey button theme. */
export const MOCK_WORKSPACE_THEME = {
  backgroundColor: "#0f172a",
  textColor: "#ffffff",
  borderColor: "#0f172a",
};

export const getMockLinkedSurvey = (creative: Pick<TCreative, "action">): TCreativeSurveyOption | null => {
  if (creative.action.kind !== "survey" || !creative.action.surveyId) return null;
  const { surveyId } = creative.action;
  return MOCK_SURVEYS.find((survey) => survey.id === surveyId) ?? null;
};

export const getMockDisplayState = (creative: TCreative, now: Date): TCreativeDisplayState =>
  getCreativeDisplayState(
    {
      status: creative.status,
      archivedAt: creative.archivedAt,
      startsAt: creative.startsAt,
      endsAt: creative.endsAt,
      linkedSurveyStatus: getMockLinkedSurvey(creative)?.status ?? null,
    },
    now
  );

const urlStartsWith = (id: string, path: string): TShowConditions => ({
  id: `${id}_group`,
  connector: "and",
  conditions: [
    {
      id: `${id}_url`,
      leftOperand: { type: "page", value: "currentUrl" },
      operator: "contains",
      rightOperand: { type: "static", value: path },
    },
  ],
});

const DEFAULT_STYLING: TCreativeStyling = {
  useWorkspaceTheme: true,
  ...MOCK_WORKSPACE_THEME,
  radius: 8,
  font: "inherit",
  fontWeight: 500,
};

const FEEDBACK_LAYOUT: TCreativeLayout = {
  edge: "right",
  bannerPosition: "top",
  offset: 50,
  fontSize: 15,
  paddingX: 14,
  paddingY: 10,
};

const BANNER_LAYOUT: TCreativeLayout = {
  ...FEEDBACK_LAYOUT,
  edge: "bottom",
  fontSize: 14,
  paddingX: 20,
  paddingY: 12,
};

const DEFAULT_LAYOUTS: Record<TCreativeType, TCreative["layout"]> = {
  feedback_button: {
    desktop: FEEDBACK_LAYOUT,
    phone: { ...FEEDBACK_LAYOUT, edge: "bottom", offset: 80, fontSize: 14, paddingX: 12, paddingY: 8 },
  },
  banner: { desktop: BANNER_LAYOUT, phone: { ...BANNER_LAYOUT, fontSize: 13, paddingX: 14, paddingY: 10 } },
};

export const MOCK_CREATIVES: TCreative[] = [
  {
    id: "crv_give_feedback",
    name: "Give feedback",
    type: "feedback_button",
    status: "inProgress",
    archivedAt: null,
    publishedAt: daysFromNow(-60),
    startsAt: null,
    endsAt: null,
    action: { kind: "survey", surveyId: "srv_site_feedback" },
    content: { label: "Feedback", icon: "message_square", message: "", dismissible: false },
    styling: DEFAULT_STYLING,
    layout: DEFAULT_LAYOUTS.feedback_button,
    targeting: { trigger: "page_view", actionName: null, showConditions: null, sharePercent: null },
    updatedAt: daysFromNow(-14, 11),
    daily: buildDaily(30, 12_300, 0.031),
    pages: [
      { path: "/plans", impressions: 168_400, clicks: 6_120 },
      { path: "/costs", impressions: 71_350, clicks: 1_980 },
      { path: "/help", impressions: 33_870, clicks: 1_410 },
      { path: "/coverage", impressions: 21_040, clicks: 512 },
      { path: "/", impressions: 18_220, clicks: 302 },
    ],
  },
  {
    id: "crv_open_enrollment",
    name: "Open Enrollment notice",
    type: "banner",
    status: "inProgress",
    archivedAt: null,
    publishedAt: daysFromNow(-1),
    startsAt: daysFromNow(3),
    endsAt: daysFromNow(53, 23),
    action: { kind: "link", url: "https://northwindhealth.example/enroll" },
    content: {
      label: "Enroll now",
      icon: null,
      message: "Open Enrollment starts soon. Compare plans before Dec 7.",
      dismissible: true,
    },
    styling: {
      ...DEFAULT_STYLING,
      useWorkspaceTheme: false,
      backgroundColor: "#1e4f86",
      borderColor: "#1e4f86",
    },
    layout: DEFAULT_LAYOUTS.banner,
    targeting: {
      trigger: "page_view",
      actionName: null,
      showConditions: urlStartsWith("enroll", "/plans"),
      sharePercent: null,
    },
    updatedAt: daysFromNow(-13, 16),
    daily: [],
    pages: [],
  },
  {
    id: "crv_maintenance",
    name: "Planned maintenance",
    type: "banner",
    status: "draft",
    archivedAt: null,
    publishedAt: null,
    startsAt: null,
    endsAt: null,
    action: { kind: "link", url: "" },
    content: {
      label: "Learn more",
      icon: null,
      message: "Member login is down for maintenance on Sunday from 1 to 3 AM.",
      dismissible: true,
    },
    styling: DEFAULT_STYLING,
    layout: DEFAULT_LAYOUTS.banner,
    targeting: { trigger: "page_view", actionName: null, showConditions: null, sharePercent: null },
    updatedAt: daysFromNow(-12, 10),
    daily: [],
    pages: [],
  },
  {
    id: "crv_exit_invite",
    name: "Exit survey invitation",
    type: "banner",
    status: "inProgress",
    archivedAt: null,
    publishedAt: daysFromNow(-20),
    startsAt: daysFromNow(-20),
    endsAt: null,
    action: { kind: "survey", surveyId: "srv_exit" },
    content: {
      label: "Take the survey",
      icon: null,
      message: "Leaving already? Tell us what you were looking for.",
      dismissible: true,
    },
    styling: DEFAULT_STYLING,
    layout: { ...DEFAULT_LAYOUTS.banner, desktop: { ...BANNER_LAYOUT, bannerPosition: "bottom" } },
    targeting: {
      trigger: "action",
      actionName: MOCK_ACTIONS[0],
      showConditions: null,
      sharePercent: 25,
    },
    updatedAt: daysFromNow(-15, 14),
    daily: buildDaily(20, 2_100, 0.012),
    pages: [
      { path: "/plans", impressions: 23_100, clicks: 301 },
      { path: "/costs", impressions: 14_760, clicks: 162 },
      { path: "/help", impressions: 4_400, clicks: 41 },
    ],
  },
  {
    id: "crv_winter_promo",
    name: "Winter wellness promo",
    type: "feedback_button",
    status: "inProgress",
    archivedAt: null,
    publishedAt: daysFromNow(-120),
    startsAt: daysFromNow(-120),
    endsAt: daysFromNow(-30, 23),
    action: { kind: "link", url: "https://northwindhealth.example/wellness" },
    content: { label: "Wellness tips", icon: "sparkles", message: "", dismissible: false },
    styling: { ...DEFAULT_STYLING, radius: 20 },
    layout: {
      ...DEFAULT_LAYOUTS.feedback_button,
      desktop: { ...FEEDBACK_LAYOUT, edge: "left", offset: 60 },
    },
    targeting: { trigger: "page_view", actionName: null, showConditions: null, sharePercent: 50 },
    updatedAt: daysFromNow(-30, 18),
    daily: buildDaily(30, 4_800, 0.022),
    pages: [{ path: "/", impressions: 88_000, clicks: 1_870 }],
  },
  {
    id: "crv_spring_banner",
    name: "Spring checkup reminder",
    type: "banner",
    status: "completed",
    archivedAt: daysFromNow(-90),
    publishedAt: daysFromNow(-200),
    startsAt: null,
    endsAt: null,
    action: { kind: "link", url: "https://northwindhealth.example/checkup" },
    content: {
      label: "Book now",
      icon: null,
      message: "Spring checkups are free for members.",
      dismissible: true,
    },
    styling: DEFAULT_STYLING,
    layout: DEFAULT_LAYOUTS.banner,
    targeting: { trigger: "page_view", actionName: null, showConditions: null, sharePercent: null },
    updatedAt: daysFromNow(-90, 12),
    daily: buildDaily(30, 3_100, 0.018),
    pages: [{ path: "/", impressions: 61_000, clicks: 1_090 }],
  },
];

export const getMockCreative = (creativeId: string): TCreative | null =>
  MOCK_CREATIVES.find((creative) => creative.id === creativeId) ?? null;

/** What "New creative → Continue" opens: a fresh draft of the picked type. */
export const createMockDraft = (type: TCreativeType): TCreative => ({
  id: "new",
  name: "",
  type,
  status: "draft",
  archivedAt: null,
  publishedAt: null,
  startsAt: null,
  endsAt: null,
  action: { kind: "survey", surveyId: null },
  content: {
    label: type === "feedback_button" ? "Feedback" : "Learn more",
    icon: type === "feedback_button" ? "message_square" : null,
    message: "",
    dismissible: true,
  },
  styling: DEFAULT_STYLING,
  layout: DEFAULT_LAYOUTS[type],
  targeting: { trigger: "page_view", actionName: null, showConditions: null, sharePercent: null },
  updatedAt: new Date(),
  daily: [],
  pages: [],
});
