import viewNames from "./views.json";

/**
 * The views this package builds, one single-file HTML document each (`dist/views/<name>.html`).
 * `views.json` is the single list: the build reads it, and `apps/web/modules/mcp/apps` serves the documents
 * as `ui://formbricks/<name>.html` resources and links the tools that render them through
 * `_meta.ui.resourceUri` (MCP Apps, spec 2026-01-26).
 */
export const VIEW_NAMES = viewNames as readonly ViewName[];

export type ViewName =
  | "survey-preview"
  | "document-review"
  | "feedback-chart"
  | "responses"
  | "creative-preview"
  | "workflow";
