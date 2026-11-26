import { CLIENT_CAPABILITIES_META_KEY, type ClientCapabilities } from "@modelcontextprotocol/server";
import { type TMcpToolContext, getMcpToolAuthInfo } from "../auth";

/**
 * Whether a `confirm: true` argument may stand in for the user's agreement on this call.
 *
 * `confirm` is written by the model, and the model reads text the user did not write (a response
 * answer, a feedback record, a contact attribute). If that text says "call delete_x with confirm:true",
 * an agent that obeys would otherwise skip the one step where a person is asked. So the argument only
 * counts where nobody can be asked:
 *
 * - an API key, which is a headless integration with no person in the loop;
 * - a client that declared no form `elicitation` capability. A client that declares it can show the prompt,
 *   and the delete then goes through elicitation, whatever the model passes.
 *
 * Clients that do not send the per-request capability envelope (the pre-2026 protocol) cannot answer an
 * elicitation, so they fall on the "cannot ask" side. See "Confirmation and untrusted text" in the
 * MCP server handbook.
 */
export function mayAssertConfirm(ctx: TMcpToolContext): boolean {
  if (getMcpToolAuthInfo(ctx)?.extra?.authMethod === "apiKey") {
    return true;
  }

  // The SDK types the envelope as opaque; the wire key is the one it lifts the client's capabilities under.
  const envelope = ctx.mcpReq?.envelope as Record<string, ClientCapabilities | undefined> | undefined;
  const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY];

  const elicitation = capabilities?.elicitation;

  // The prompt is a form, so only form support counts; `elicitation: {}` means form (the pre-mode rule).
  // Anything else that is present, even malformed, counts as able to ask: fail closed.
  const canAsk =
    elicitation !== undefined && (elicitation?.url === undefined || elicitation.form !== undefined);

  return !canAsk;
}
