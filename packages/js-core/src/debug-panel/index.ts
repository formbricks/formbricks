import { DEBUG_SESSION_STORAGE_KEY } from "@/lib/common/constants";
import type { TDebugSurveyEvent, TDebugVisitEvent } from "@/types/debug";
import {
  describeActual,
  describeCondition,
  describeConditionTree,
  describeOutcome,
  findCondition,
} from "./format";

/**
 * The debug panel (`formbricks-debug.js`), loaded by the SDK only when the page URL carries
 * `?formbricksDebug=true`. A separate bundle, so the SDK every visitor downloads carries none of it.
 *
 * It subscribes to the SDK's `formbricks_debug` event through `formbricks.on()` and shows, per survey,
 * why it did or did not show: dropped before any trigger (display option, cooldown, segment), its show conditions with
 * what each one read, the display percentage, another survey already open. Plus the live visit.
 *
 * Rendered into a shadow root, so the host page's CSS cannot reach it and its CSS cannot leak out.
 * Every value comes from the visitor's URL, referrer or the survey's conditions, so text is only
 * ever set through `textContent`, never as HTML.
 */

const PANEL_ID = "formbricks-debug-panel";
const MAX_EVENTS_PER_SURVEY = 5;

const STYLES = `
  :host { all: initial; }
  .panel { position: fixed; bottom: 16px; left: 16px; z-index: 2147483647; width: 360px; max-width: calc(100vw - 32px);
    max-height: 60vh; overflow: auto; background: #fff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 8px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18); font: 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: #fff; }
  .title { font-weight: 600; }
  .actions { display: flex; gap: 6px; }
  button { font: inherit; background: none; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 8px; cursor: pointer; color: inherit; }
  .section { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
  .heading { font-weight: 600; color: #475569; margin-bottom: 4px; }
  .row { margin: 2px 0; word-break: break-all; }
  .muted { color: #64748b; }
  .survey { margin-bottom: 8px; }
  .ok { color: #15803d; }
  .fail { color: #b91c1c; }
`;

interface TPanelState {
  visit?: TDebugVisitEvent;
  surveys: Map<string, TDebugSurveyEvent[]>;
  collapsed: boolean;
}

const state: TPanelState = { surveys: new Map(), collapsed: false };

// Typed loosely on purpose: the panel can run next to an SDK of another version.
type TWindowWithFormbricks = Window & {
  formbricks?: { on?: (event: "formbricks_debug", handler: (event: unknown) => void) => unknown };
};

const element = (tag: string, className?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const formatTime = (at: number): string => new Date(at).toLocaleTimeString();

const renderVisit = (): HTMLElement => {
  const section = element("div", "section");
  section.appendChild(element("div", "heading", "This visit"));

  if (!state.visit) {
    section.appendChild(element("div", "row muted", "No page counted yet."));
    return section;
  }

  const { visit, device } = state.visit;
  if (visit) {
    section.appendChild(
      element(
        "div",
        "row",
        `Pages viewed: ${visit.pagesViewed.toString()} (${visit.uniquePagesViewed.toString()} unique)`
      )
    );
    section.appendChild(element("div", "row", `Time on site: ${visit.timeOnSite.toString()} s`));
    section.appendChild(element("div", "row", `Entry referrer: ${visit.entryReferrer || "none (direct)"}`));
    section.appendChild(element("div", "row", `Visited: ${visit.visitedUrls.join(" · ")}`));
  } else {
    section.appendChild(
      element("div", "row fail", "Visit unavailable: the browser blocks storage, so visit conditions fail.")
    );
  }
  section.appendChild(
    element(
      "div",
      "row",
      `Device: ${device.deviceType} · ${device.browser} · window ${device.screenWidth.toString()} px`
    )
  );
  return section;
};

/** One line per condition of a check, with what each one read. */
const renderConditionResults = (check: TDebugSurveyEvent | undefined): HTMLElement[] => {
  if (!check?.conditions) return [];
  const { results } = check.conditions;
  if (results.length === 0) return [element("div", "row muted", "No show conditions.")];

  const tree = describeConditionTree(check.showConditions, check.conditions);
  if (tree) {
    return tree.map(({ depth, passed, text }) => {
      const row = element("div", `row ${passed ? "ok" : "fail"}`, `${passed ? "✓" : "✗"} ${text}`);
      row.style.paddingLeft = `${(depth * 14).toString()}px`;
      return row;
    });
  }

  return results.map((result) => {
    const condition = findCondition(check.showConditions, result.conditionId);
    const label = condition ? describeCondition(condition) : result.conditionId;
    return element(
      "div",
      `row ${result.passed ? "ok" : "fail"}`,
      `${result.passed ? "✓" : "✗"} ${label} — read: ${describeActual(result.actual)}`
    );
  });
};

const renderSurvey = (surveyId: string, events: TDebugSurveyEvent[]): HTMLElement => {
  const block = element("div", "survey");
  block.appendChild(element("div", "row title", `Survey ${surveyId}`));
  const latest = events.at(-1);
  if (latest) {
    block.appendChild(
      element("div", "row muted", `${formatTime(latest.at)} · trigger: ${latest.action ?? "unknown"}`)
    );
  }

  const newestFirst = events.slice().reverse();
  for (const event of newestFirst) {
    block.appendChild(element("div", `row ${event.outcome === "shown" ? "ok" : ""}`, describeOutcome(event)));
  }
  // The last condition check, even if a later event (shown, another survey open) came after it.
  block.append(...renderConditionResults(newestFirst.find((event) => event.conditions)));
  return block;
};

const lastEventAt = (events: TDebugSurveyEvent[]): number => events.at(-1)?.at ?? 0;

const renderSurveys = (): HTMLElement => {
  const section = element("div", "section");
  section.appendChild(element("div", "heading", "Surveys on fired triggers"));
  if (state.surveys.size === 0) {
    section.appendChild(element("div", "row muted", "No trigger has fired yet."));
    return section;
  }
  const newestFirst = [...state.surveys.entries()].sort(([, a], [, b]) => lastEventAt(b) - lastEventAt(a));
  for (const [surveyId, events] of newestFirst) section.appendChild(renderSurvey(surveyId, events));
  return section;
};

const render = (container: HTMLElement): void => {
  container.replaceChildren();

  const header = element("div", "header");
  header.appendChild(element("span", "title", "Formbricks debug"));
  const actions = element("span", "actions");
  const toggle = element("button", undefined, state.collapsed ? "Show" : "Hide");
  toggle.addEventListener("click", () => {
    state.collapsed = !state.collapsed;
    render(container);
  });
  // Debug mode stays on for the tab (see `getIsDebug`). This ends it from the next page on, unless
  // that page's URL carries `?formbricksDebug=true` again.
  const turnOff = element("button", undefined, "Turn off");
  turnOff.title = "Turn debug mode off for this tab";
  turnOff.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(DEBUG_SESSION_STORAGE_KEY);
    } catch {
      // Storage is blocked, so debug mode was never remembered beyond this URL.
    }
    document.getElementById(PANEL_ID)?.remove();
  });
  actions.append(toggle, turnOff);
  header.appendChild(actions);
  container.appendChild(header);

  if (state.collapsed) return;
  container.appendChild(renderVisit());
  container.appendChild(renderSurveys());
};

// The SDK and this panel are cached separately, so anything unexpected is ignored, not trusted.
const isSurveyEvent = (value: unknown): value is TDebugSurveyEvent =>
  typeof value === "object" && value !== null && (value as { type?: unknown }).type === "survey";
const isVisitEvent = (value: unknown): value is TDebugVisitEvent =>
  typeof value === "object" && value !== null && (value as { type?: unknown }).type === "visit";

const handleEvent = (detail: unknown): void => {
  if (isVisitEvent(detail)) {
    state.visit = detail;
  } else if (isSurveyEvent(detail)) {
    const events = state.surveys.get(detail.surveyId) ?? [];
    events.push(detail);
    state.surveys.set(detail.surveyId, events.slice(-MAX_EVENTS_PER_SURVEY));
  }
};

const mount = (): void => {
  if (document.getElementById(PANEL_ID)) return;

  const host = document.createElement("div");
  host.id = PANEL_ID;
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  const container = element("div", "panel");
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", "Formbricks debug");
  shadow.append(style, container);
  render(container);

  // The SDK replays what already happened on this page to a new subscriber, then sends the rest live.
  const sdk = (window as TWindowWithFormbricks).formbricks;
  if (typeof sdk?.on !== "function") {
    container.appendChild(element("div", "section fail", "The Formbricks SDK was not found on this page."));
    return;
  }
  sdk.on("formbricks_debug", (event) => {
    handleEvent(event);
    render(container);
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
