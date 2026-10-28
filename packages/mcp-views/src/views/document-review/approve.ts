/**
 * What approving does: the checks and the one push behind the "Approve and apply" button, kept out of the
 * component so every way it can end is tested. The host call is injected; this never touches the SDK.
 */
import { isRecord } from "../../shared/guards";
import type { ToolContentBlock, ToolResult } from "../../shared/tool-result";
import {
  type ApplyOutcome,
  type DocumentReview,
  type FailureReason,
  type ReviewedArguments,
  buildPushArguments,
  getApprovalBlock,
  readApplyOutcome,
} from "./review";

/** The host's `tools/call`. Its answer is read with a guard below rather than trusted to have a shape. */
export type CallTool = (params: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;

const isContentBlock = (value: unknown): value is ToolContentBlock =>
  isRecord(value) &&
  typeof value.type === "string" &&
  (value.text === undefined || typeof value.text === "string");

/** The slice of a `CallToolResult` the view reads; anything that is not one reads as an empty result. */
export const toToolResult = (value: unknown): ToolResult => {
  if (!isRecord(value)) return {};
  return {
    ...(Array.isArray(value.content) && { content: value.content.filter(isContentBlock) }),
    ...(isRecord(value.structuredContent) && { structuredContent: value.structuredContent }),
    ...(value.isError === true && { isError: true }),
  };
};

const failure = (reason: FailureReason, title: string, detail: string): ApplyOutcome => ({
  ok: false,
  reason,
  title,
  detail,
  issues: [],
});

type ApproveParams = {
  callTool: CallTool;
  review: DocumentReview;
  reviewed: ReviewedArguments;
  /** Whether the person ticked the box that confirms a destructive change. */
  confirmed: boolean;
};

/**
 * Pushes the reviewed document, once, if approval is still allowed. The checks run here again, at the
 * moment of approving: the buttons are disabled for the same reasons, but this is the place that decides
 * what is sent. A document version that differs from the one the review was made against is refused
 * before anything leaves the view, with a notice of its own. Never throws: a host that cannot reach the
 * server is an outcome like any other.
 */
export const approveReview = async ({
  callTool,
  review,
  reviewed,
  confirmed,
}: ApproveParams): Promise<ApplyOutcome> => {
  const block = getApprovalBlock(review, reviewed, confirmed);
  if (!reviewed.ok || block) {
    if (block === "version") {
      return failure(
        "version",
        "This review is for a different document version",
        "The document version in the change is not the one the review was made against, so it was not pushed. Nothing was written."
      );
    }
    return failure("blocked", "This change cannot be approved", "Nothing was written.");
  }

  try {
    // Exactly the reviewed arguments; `confirmDestructive` only if the person ticked the box.
    const result = await callTool({
      name: "push_document",
      arguments: buildPushArguments(reviewed.args, confirmed),
    });
    return readApplyOutcome(toToolResult(result));
  } catch (error) {
    return failure(
      "unreachable",
      "The push did not go through",
      error instanceof Error && error.message ? error.message : "The host could not reach the server."
    );
  }
};
