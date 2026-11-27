import {
  type CallToolResult,
  type InputRequiredResult,
  acceptedContent,
  inputRequired,
  inputResponse,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { TMcpToolContext } from "../auth";
import { type TMcpConfirmationState, mcpRequestStateCodec } from "../request-state";
import { mayAssertConfirm } from "./confirm-gate";
import { toolContext } from "./tool-context";

/** The key the confirmation elicitation is filed under, on both the request and the retry. */
const CONFIRM_KEY = "confirm";

const ZConfirmationAnswer = z.object({ confirm: z.boolean() });

type TDeleteDecision = { kind: "confirmed" } | { kind: "ask" } | { kind: "refused"; reason: string };

/**
 * A refusal shaped like the error half of the output schema, so a client reading
 * `structuredContent` against the advertised schema sees the same shape it sees for a 403.
 *
 * **`isError` is set, although nothing malfunctioned.** The first version left it off, reasoning that
 * a declined confirmation is the tool working correctly. That is true and beside the point: a model
 * that reads only `isError` would take the absence as success and tell the user their response was
 * deleted when it was not. Of the two ways to be wrong — a model that retries, or a model that
 * reports a deletion that never happened — only one of them misleads a person about their data.
 */
export const refusal = (reason: string, requestId: string): CallToolResult => {
  const payload = { error: { status: 428, title: "Confirmation required", detail: reason, requestId } };

  return {
    isError: true,
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
};

/**
 * Whether this round already carries the user's agreement, and whether that agreement is about the
 * resources actually named in the arguments.
 *
 * **The resource check is the reason the state is sealed at all.** `requestState` and the tool
 * arguments both come back through the client, so without comparing them a client could be asked
 * about response A and retry the confirmation against response B. The HMAC proves this server minted
 * the state for this caller; the comparison proves it is about this delete.
 */
export function decideDelete(
  tool: string,
  resourceKey: string,
  confirm: boolean | undefined,
  ctx: TMcpToolContext
): TDeleteDecision {
  // Only where nobody can be asked: see `mayAssertConfirm`.
  if (confirm === true && mayAssertConfirm(ctx)) {
    return { kind: "confirmed" };
  }

  const answer = inputResponse(ctx.mcpReq?.inputResponses, CONFIRM_KEY);

  if (answer.kind === "missing") {
    return { kind: "ask" };
  }

  if (answer.kind !== "elicit" || answer.action !== "accept") {
    return { kind: "refused", reason: "Deletion was not confirmed, so nothing was deleted." };
  }

  const content = acceptedContent(ctx.mcpReq?.inputResponses, CONFIRM_KEY, ZConfirmationAnswer);

  if (content?.confirm !== true) {
    return { kind: "refused", reason: "Deletion was declined, so nothing was deleted." };
  }

  const state = ctx.mcpReq?.requestState<TMcpConfirmationState>();

  if (!state || typeof state !== "object" || state.tool !== tool || state.resourceId !== resourceKey) {
    return {
      kind: "refused",
      reason: "The confirmation did not match this request, so nothing was deleted.",
    };
  }

  return { kind: "confirmed" };
}

/**
 * Ask, and hand the client everything it needs to come back.
 *
 * On a client that cannot elicit this result is never reached usefully — which is why the delete
 * tools take `confirm` as an argument. That is not a fallback bolted on afterwards: it is the path a
 * 2025-era client and a headless caller use, and it is the reason the tools work at all without
 * elicitation support.
 */
export async function askToConfirm(
  tool: string,
  resourceKey: string,
  message: string,
  ctx: TMcpToolContext
): Promise<InputRequiredResult> {
  return inputRequired({
    inputRequests: {
      [CONFIRM_KEY]: inputRequired.elicit({
        message,
        requestedSchema: ZConfirmationAnswer,
      }),
    },
    requestState: await mcpRequestStateCodec.mint({ tool, resourceId: resourceKey }, ctx),
  });
}

/**
 * The ask / refuse / run sequence every confirmed delete shares, so a tool states only what it deletes.
 *
 * `run` is reached only when the user agreed: through the prompt, or through `confirm: true` where
 * `mayAssertConfirm` allows it.
 */
export async function runConfirmedDelete(options: {
  tool: string;
  resourceKey: string;
  prompt: string;
  confirm: boolean | undefined;
  ctx: TMcpToolContext;
  run: () => Promise<CallToolResult>;
}): Promise<CallToolResult | InputRequiredResult> {
  const { tool, resourceKey, prompt, confirm, ctx, run } = options;
  const decision = decideDelete(tool, resourceKey, confirm, ctx);

  if (decision.kind === "ask") {
    return await askToConfirm(tool, resourceKey, prompt, ctx);
  }

  if (decision.kind === "refused") {
    return refusal(decision.reason, toolContext(ctx).requestId);
  }

  return run();
}
