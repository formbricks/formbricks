import { FORMBRICKS_DEBUG_EVENT, notifyFormbricksSubscribers, onFormbricksEvent } from "@/lib/common/events";
import { getIsDebug } from "@/lib/common/utils";
import type { TDebugEvent, TDebugSurveyEvent, TDebugVisitEvent } from "@/types/debug";

const DEBUG_PANEL_SCRIPT_ID = "formbricks-debug-panel-script";
const MAX_BUFFERED_EVENTS = 200;

const buffer: TDebugEvent[] = [];
let isDebugSession = false;

/** Whether debug events are emitted. Everything here costs nothing when this is false. */
export const isDebugEnabled = (): boolean => isDebugSession || getIsDebug();

const emit = (event: TDebugEvent): void => {
  if (!isDebugEnabled()) return;
  buffer.push(event);
  if (buffer.length > MAX_BUFFERED_EVENTS) buffer.shift();
  notifyFormbricksSubscribers(FORMBRICKS_DEBUG_EVENT, event);
};

export const emitDebugSurveyEvent = (event: Omit<TDebugSurveyEvent, "type" | "at">): void => {
  emit({ type: "survey", at: Date.now(), ...event });
};

export const emitDebugVisitEvent = (event: Omit<TDebugVisitEvent, "type" | "at">): void => {
  emit({ type: "visit", at: Date.now(), ...event });
};

/**
 * `formbricks.on("formbricks_debug", handler)`. The handler first receives what already happened on
 * this page, because the debug panel is a script that loads after `setup()` has counted the page,
 * and a host handler may be registered late too.
 */
export const onDebugEvent = (handler: (event: TDebugEvent) => void): (() => void) => {
  const unsubscribe = onFormbricksEvent(FORMBRICKS_DEBUG_EVENT, handler);
  [...buffer].forEach((event) => {
    try {
      handler(event);
    } catch (error) {
      console.error(`Formbricks: a "${FORMBRICKS_DEBUG_EVENT}" event handler threw`, error);
    }
  });
  return unsubscribe;
};

/**
 * Called once from `setup()` in debug mode. Debug mode is remembered for the rest of the page too,
 * because an SPA route change can leave a URL the flag cannot be read from. The panel itself is a
 * separate bundle, so the SDK every visitor downloads carries none of its code.
 */
export const startDebugSession = (appUrl: string): void => {
  isDebugSession = true;

  if (document.getElementById(DEBUG_PANEL_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = DEBUG_PANEL_SCRIPT_ID;
  script.src = `${appUrl}/js/formbricks-debug.js`;
  script.async = true;
  document.head.appendChild(script);
};
