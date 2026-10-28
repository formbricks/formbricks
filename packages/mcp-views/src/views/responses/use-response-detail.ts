import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useState } from "react";
import type { DetailModel } from "./detail";
import { loadResponseDetail } from "./loaders";

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
    void loadResponseDetail((params) => app.callServerTool(params), responseId).then((parsed) => {
      if (run.cancelled) return;
      setState(
        parsed.ok ? { status: "ready", detail: parsed.value } : { status: "error", message: parsed.message }
      );
    });
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
