import type { TPublishIssue } from "./publish-check";
import type { TCreativeStylingForm } from "./styling-form";

/**
 * The editor panels that fold to one summary row: the Styling cards, whose every field overrides a
 * workspace value, and the two optional Settings cards. Content, Language and Show on stay open: they
 * are short and mostly required, so folding them would hide their errors.
 */
export type TEditorPanelId = "colors" | "shapeAndSize" | "position" | "customCss" | "showWhen" | "schedule";

/** The panels "Add custom styles" locks: they close when it turns off. */
export const CUSTOM_STYLE_PANELS: readonly TEditorPanelId[] = ["colors", "shapeAndSize", "customCss"];

/** On load only Colors is open, and only when custom styles are on (Position applies either way). */
export const getInitialOpenPanels = (styling: TCreativeStylingForm): ReadonlySet<TEditorPanelId> =>
  new Set<TEditorPanelId>(styling.theme.customStyles ? ["colors"] : []);

export const withPanelsOpen = (
  current: ReadonlySet<TEditorPanelId>,
  ids: readonly TEditorPanelId[],
  open: boolean
): ReadonlySet<TEditorPanelId> => {
  const next = new Set(current);
  for (const id of ids) {
    if (open) next.add(id);
    else next.delete(id);
  }
  return next;
};

/** The panel a flagged issue opens. Issues on panels that don't fold (Content, Show on) have none. */
export const PUBLISH_ISSUE_PANELS: Partial<Record<TPublishIssue, TEditorPanelId>> = {
  condition_incomplete: "showWhen",
  end_before_start: "schedule",
};

const COLOR_FIELDS = new Set(["backgroundColor", "textColor", "borderColor"]);
const SHAPE_FIELDS = new Set(["fontSize", "paddingX", "paddingY", "borderRadius", "fontWeight", "pageFont"]);

/**
 * The panel that edits a field a v3 write refused (its `invalid_params[].name`, e.g.
 * `styling.theme.customCss` or `schedule.endAt`); `null` when no folding panel owns it, where the tab's
 * dot is enough. One level deeper than `getInvalidParamTab`.
 */
export const getInvalidParamPanel = (paramName: string): TEditorPanelId | null => {
  const [group, section, field] = paramName.split(/[.[\]]+/);
  if (group === "schedule") return "schedule";
  if (group === "distribution") {
    return section === "conditions" || section === "displayPercentage" ? "showWhen" : null;
  }
  if (group !== "styling") return null;
  if (section === "position") return "position";
  if (section !== "theme" || field === undefined) return null;
  if (field === "customCss") return "customCss";
  if (COLOR_FIELDS.has(field)) return "colors";
  if (SHAPE_FIELDS.has(field)) return "shapeAndSize";
  return null;
};
