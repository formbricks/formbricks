import "server-only";
import { assertCan } from "@/lib/authorization";

export const assertFeedbackSourceDirectoryAccess = async (
  userId: string,
  feedbackDirectoryId: string,
  workspaceId: string,
  permission: "read" | "write"
): Promise<void> =>
  assertCan({ type: "user", id: userId }, `feedbackDirectoryAssignment.${permission}`, {
    type: "feedbackDirectoryAssignment",
    id: feedbackDirectoryId,
    workspaceId,
  });
