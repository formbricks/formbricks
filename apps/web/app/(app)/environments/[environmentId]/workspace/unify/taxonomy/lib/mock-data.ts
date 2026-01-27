import type { TaxonomyDetail, TaxonomyKeyword, TaxonomyThemeItem } from "../types";

export const MOCK_LEVEL1_KEYWORDS: TaxonomyKeyword[] = [
  { id: "l1-1", name: "Dashboard", count: 12400 },
  { id: "l1-2", name: "Usability", count: 8200 },
  { id: "l1-3", name: "Performance", count: 5600 },
  { id: "l1-4", name: "Miscellaneous", count: 3100 },
];

export const MOCK_LEVEL2_KEYWORDS: Record<string, TaxonomyKeyword[]> = {
  "l1-1": [
    { id: "l2-1a", name: "Survey overview", count: 5200, parentId: "l1-1" },
    { id: "l2-2a", name: "Response metrics", count: 3800, parentId: "l1-1" },
    { id: "l2-3a", name: "Analytics & reports", count: 2400, parentId: "l1-1" },
    { id: "l2-4a", name: "Widgets & embedding", count: 800, parentId: "l1-1" },
    { id: "l2-5a", name: "Not specified", count: 200, parentId: "l1-1" },
  ],
  "l1-2": [
    { id: "l2-1b", name: "Survey builder", count: 3200, parentId: "l1-2" },
    { id: "l2-2b", name: "Question types", count: 2100, parentId: "l1-2" },
    { id: "l2-3b", name: "Logic & branching", count: 1400, parentId: "l1-2" },
    { id: "l2-4b", name: "Styling & theming", count: 900, parentId: "l1-2" },
    { id: "l2-5b", name: "Not specified", count: 600, parentId: "l1-2" },
  ],
  "l1-3": [
    { id: "l2-1c", name: "Load time & speed", count: 2200, parentId: "l1-3" },
    { id: "l2-2c", name: "Survey rendering", count: 1600, parentId: "l1-3" },
    { id: "l2-3c", name: "SDK & integration", count: 1100, parentId: "l1-3" },
    { id: "l2-4c", name: "API & data sync", count: 500, parentId: "l1-3" },
    { id: "l2-5c", name: "Not specified", count: 200, parentId: "l1-3" },
  ],
  "l1-4": [
    { id: "l2-1d", name: "Feature requests", count: 1500, parentId: "l1-4" },
    { id: "l2-2d", name: "Bug reports", count: 900, parentId: "l1-4" },
    { id: "l2-3d", name: "Documentation", count: 400, parentId: "l1-4" },
    { id: "l2-4d", name: "Not specified", count: 300, parentId: "l1-4" },
  ],
};

export const MOCK_LEVEL3_KEYWORDS: Record<string, TaxonomyKeyword[]> = {
  "l2-1a": [
    { id: "l3-1a", name: "In-app surveys", count: 2800, parentId: "l2-1a" },
    { id: "l3-2a", name: "Link surveys", count: 1600, parentId: "l2-1a" },
    { id: "l3-3a", name: "Response summary", count: 600, parentId: "l2-1a" },
    { id: "l3-4a", name: "Not specified", count: 200, parentId: "l2-1a" },
  ],
  "l2-2a": [
    { id: "l3-5a", name: "Completion rate", count: 1800, parentId: "l2-2a" },
    { id: "l3-6a", name: "Drop-off points", count: 1200, parentId: "l2-2a" },
    { id: "l3-7a", name: "Response distribution", count: 800, parentId: "l2-2a" },
  ],
  "l2-1b": [
    { id: "l3-1b", name: "Drag & drop editor", count: 1400, parentId: "l2-1b" },
    { id: "l3-2b", name: "Question configuration", count: 900, parentId: "l2-1b" },
    { id: "l3-3b", name: "Multi-language surveys", count: 500, parentId: "l2-1b" },
    { id: "l3-4b", name: "Not specified", count: 400, parentId: "l2-1b" },
  ],
  "l2-2b": [
    { id: "l3-5b", name: "Open text & NPS", count: 1100, parentId: "l2-2b" },
    { id: "l3-6b", name: "Multiple choice & rating", count: 600, parentId: "l2-2b" },
    { id: "l3-7b", name: "File upload & date picker", count: 400, parentId: "l2-2b" },
  ],
  "l2-1c": [
    { id: "l3-1c", name: "Widget initialization", count: 900, parentId: "l2-1c" },
    { id: "l3-2c", name: "Survey load delay", count: 700, parentId: "l2-1c" },
    { id: "l3-3c", name: "Bundle size impact", count: 600, parentId: "l2-1c" },
  ],
  "l2-1d": [
    { id: "l3-1d", name: "New question types", count: 600, parentId: "l2-1d" },
    { id: "l3-2d", name: "Integrations & webhooks", count: 500, parentId: "l2-1d" },
    { id: "l3-3d", name: "Export & reporting", count: 400, parentId: "l2-1d" },
  ],
};

export function getL2Keywords(parentL1Id: string): TaxonomyKeyword[] {
  return MOCK_LEVEL2_KEYWORDS[parentL1Id] ?? [];
}

export function getL3Keywords(parentL2Id: string): TaxonomyKeyword[] {
  return MOCK_LEVEL3_KEYWORDS[parentL2Id] ?? [];
}

export const MOCK_DETAIL_L3: Record<string, TaxonomyDetail> = {
  "l3-1a": {
    keywordId: "l3-1a",
    keywordName: "In-app surveys",
    count: 2800,
    description:
      "Feedback collected directly inside your product. Formbricks in-app surveys are triggered by actions (e.g. page view, click) and can be shown as modal, full-width, or inline widgets.",
    themes: [
      { id: "t1", label: "Issues", count: 1200, color: "red" },
      { id: "t2", label: "Ideas", count: 900, color: "orange" },
      { id: "t3", label: "Questions", count: 500, color: "yellow" },
      { id: "t4", label: "Other", count: 200, color: "green" },
    ],
    themeItems: [
      {
        id: "ti-1",
        label: "Survey not showing on trigger",
        count: 420,
        icon: "warning",
        children: [
          { id: "ti-1-1", label: "Wrong environment or survey ID", count: 200 },
          { id: "ti-1-2", label: "Trigger conditions not met", count: 150 },
          { id: "ti-1-3", label: "SDK not loaded in time", count: 70 },
        ],
      },
      { id: "ti-2", label: "Positioning and placement", count: 310, icon: "wrench" },
      { id: "ti-3", label: "Request for more trigger types", count: 280, icon: "lightbulb" },
      { id: "ti-4", label: "Miscellaneous in-app feedback", count: 190, icon: "message-circle" },
    ],
  },
  "l3-1b": {
    keywordId: "l3-1b",
    keywordName: "Drag & drop editor",
    count: 1400,
    description:
      "The Formbricks survey builder lets you add and reorder questions with drag and drop, configure question settings, and preview surveys before publishing.",
    themes: [
      { id: "t1", label: "Issues", count: 600, color: "red" },
      { id: "t2", label: "Ideas", count: 500, color: "orange" },
      { id: "t3", label: "Questions", count: 250, color: "yellow" },
      { id: "t4", label: "Other", count: 50, color: "green" },
    ],
    themeItems: [
      { id: "ti-1", label: "Reordering fails with many questions", count: 220, icon: "warning" },
      { id: "ti-2", label: "Request for keyboard shortcuts", count: 180, icon: "lightbulb" },
      { id: "ti-3", label: "Undo / redo in editor", count: 150, icon: "lightbulb" },
      { id: "ti-4", label: "Miscellaneous builder feedback", count: 100, icon: "message-circle" },
    ],
  },
  "l3-1c": {
    keywordId: "l3-1c",
    keywordName: "Widget initialization",
    count: 900,
    description:
      "How quickly the Formbricks widget loads and becomes ready to display surveys. Includes script load time, SDK init, and first-paint for survey UI.",
    themes: [
      { id: "t1", label: "Issues", count: 550, color: "red" },
      { id: "t2", label: "Ideas", count: 250, color: "orange" },
      { id: "t3", label: "Questions", count: 100, color: "yellow" },
      { id: "t4", label: "Other", count: 0, color: "green" },
    ],
    themeItems: [
      { id: "ti-1", label: "Slow init on mobile networks", count: 280, icon: "warning" },
      { id: "ti-2", label: "Blocking main thread", count: 180, icon: "warning" },
      { id: "ti-3", label: "Lazy-load SDK suggestion", count: 120, icon: "lightbulb" },
    ],
  },
  "l3-1d": {
    keywordId: "l3-1d",
    keywordName: "New question types",
    count: 600,
    description:
      "Requests for additional question types in Formbricks surveys (e.g. matrix, ranking, sliders, image choice) to capture different kinds of feedback.",
    themes: [
      { id: "t1", label: "Ideas", count: 450, color: "orange" },
      { id: "t2", label: "Questions", count: 100, color: "yellow" },
      { id: "t3", label: "Other", count: 50, color: "green" },
    ],
    themeItems: [
      { id: "ti-1", label: "Matrix / grid question", count: 180, icon: "lightbulb" },
      { id: "ti-2", label: "Ranking question type", count: 120, icon: "lightbulb" },
      { id: "ti-3", label: "Slider and scale variants", count: 90, icon: "lightbulb" },
    ],
  },
};

export function getDetailForL3(keywordId: string): TaxonomyDetail | null {
  return MOCK_DETAIL_L3[keywordId] ?? null;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
