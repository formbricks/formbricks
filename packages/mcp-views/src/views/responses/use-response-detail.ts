import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useState } from "react";
import { type DetailModel, parseDetail } from "./detail";

export type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: DetailModel };

/**
 * Loads one response in full through `get_response`. The panel is keyed by response id, so a new
 * response means a new mount and a fresh `loading` state; `reload` is the only way back to it.
 */
export const useResponseDetail = (
  app: App | null,
  responseId: string
): { state: DetailState; reload: () => void } => {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!app) return;
    const run = { cancelled: false };
    void (async () => {
      let next: DetailState;
      try {
        const result = await app.callServerTool({ name: "get_response", arguments: { responseId } });
        const parsed = parseDetail(result);
        next = parsed.ok
          ? { status: "ready", detail: parsed.value }
          : { status: "error", message: parsed.message };
      } catch (error) {
        next = {
          status: "error",
          message: error instanceof Error && error.message ? error.message : "The request failed.",
        };
      }
      if (!run.cancelled) setState(next);
    })();
    return () => {
      run.cancelled = true;
    };
  }, [app, responseId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  return { state, reload };
};
