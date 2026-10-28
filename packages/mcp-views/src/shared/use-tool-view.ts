import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useMemo, useState } from "react";
import type { ToolResult } from "./tool-result";

export interface ToolViewState {
  app: App | null;
  isConnected: boolean;
  connectionError: Error | null;
  /** Arguments the model called the tool with (`ui/notifications/tool-input`). */
  input: Record<string, unknown> | null;
  /** The result the host pushes when the tool call completes (`ui/notifications/tool-result`). */
  result: ToolResult | null;
  /** Set when the host cancelled the call before it produced a result. */
  cancelledReason: string | null;
  hostContext: McpUiHostContext | undefined;
}

const APP_INFO = { name: "Formbricks", version: "1.0.0" };

/**
 * Connects the view to its host and tracks the three things every Formbricks view renders from: the
 * tool input, the tool result and the host context. Follows the lifecycle in the MCP Apps spec
 * (2026-01-26): `ui/initialize` and `ui/notifications/initialized` are handled by the SDK's `App`, the
 * host sends `tool-input` then `tool-result` afterwards, and `ui/resource-teardown` is acknowledged so
 * the host can remove the frame without waiting for a timeout.
 *
 * Theme and style variables are applied to the document here, once, so a view only reads CSS variables.
 */
export const useToolView = (): ToolViewState => {
  const [input, setInput] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [cancelledReason, setCancelledReason] = useState<string | null>(null);
  const [hostContextPatch, setHostContextPatch] = useState<McpUiHostContext>({});

  const onAppCreated = useCallback((created: App) => {
    created.ontoolinput = (params) => setInput(params.arguments ?? {});
    created.ontoolresult = (params) => setResult(params as ToolResult);
    created.ontoolcancelled = (params) => setCancelledReason(params.reason ?? "cancelled");
    created.onhostcontextchanged = (params) =>
      setHostContextPatch((previous) => ({ ...previous, ...params }));
    created.onteardown = () => Promise.resolve({});
  }, []);

  const { app, isConnected, error } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated,
  });

  // The context the host sent in `ui/initialize`, with every `host-context-changed` patch merged on top.
  const hostContext = useMemo<McpUiHostContext | undefined>(
    () => (isConnected && app ? { ...app.getHostContext(), ...hostContextPatch } : undefined),
    [app, isConnected, hostContextPatch]
  );

  useHostStyles(app, hostContext);

  return { app, isConnected, connectionError: error, input, result, cancelledReason, hostContext };
};
