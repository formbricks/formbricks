import { type DigDeeperTarget, buildDigDeeperPrompt } from "./prompt";

/** What the view needs of `app.sendMessage`; injected so the flow runs without a host. */
export type SendMessage = (params: {
  role: "user";
  content: { type: "text"; text: string }[];
}) => Promise<{ isError?: boolean }>;

export type SendOutcome = "sent" | "failed";

/**
 * Sends the "break this down" message for a selected point and reports whether the host took it. The
 * text comes from `buildDigDeeperPrompt` alone (ids and query members, never chart labels or values); a
 * host that refuses it or throws is a failure the person is told about, not an exception.
 */
export const sendDigDeeper = async (
  sendMessage: SendMessage,
  target: DigDeeperTarget
): Promise<SendOutcome> => {
  try {
    const response = await sendMessage({
      role: "user",
      content: [{ type: "text", text: buildDigDeeperPrompt(target) }],
    });
    return response.isError ? "failed" : "sent";
  } catch {
    return "failed";
  }
};
