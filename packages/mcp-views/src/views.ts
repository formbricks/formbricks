/**
 * The views this package builds, one single-file HTML document each (`dist/views/<name>.html`).
 * `apps/web/modules/mcp/apps` serves them as `ui://formbricks/<name>.html` resources and links the
 * tools that render them through `_meta.ui.resourceUri` (MCP Apps, spec 2026-01-26).
 */
export const VIEW_NAMES = [
  "survey-preview",
  "document-review",
  "feedback-chart",
  "responses",
  "creative-preview",
  "workflow",
] as const;

export type ViewName = (typeof VIEW_NAMES)[number];
