import "server-only";
import { createHash } from "node:crypto";

const frame = (value: string): string => `${Buffer.byteLength(value, "utf8")}:${value}`;

/**
 * Stable opaque SpiceDB object ID for one `FeedbackDirectoryWorkspace` pair.
 *
 * Length framing makes concatenation unambiguous and UTF-8 byte lengths keep the hash stable across
 * runtimes. This module is direct-path and server-only so neither source identifier reaches client code.
 */
export const getFeedbackDirectoryAssignmentObjectId = (
  feedbackDirectoryId: string,
  workspaceId: string
): string =>
  `fdwa_${createHash("sha256")
    .update(`${frame(feedbackDirectoryId)}${frame(workspaceId)}`, "utf8")
    .digest("hex")}`;
