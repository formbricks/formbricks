import { V3ApiError } from "@/modules/api/lib/v3-client";
import { TagError } from "@/modules/workspaces/settings/types/tag";

/**
 * Whether a rename was refused because another tag already has that name.
 *
 * `PATCH /api/v3/tags/{tagId}` reports it as an RFC 9457 `invalid_params` entry whose `reason` carries the
 * service's error code, and deliberately keeps the top-level `detail` generic. So `invalid_params` is the
 * only place the duplicate case is distinguishable from any other 422 — matching
 * `use-workflow-builder.ts`, which reads the same extension for the same reason.
 */
export const isDuplicateTagNameError = (error: unknown): boolean =>
  error instanceof V3ApiError &&
  (error.invalid_params ?? []).some((param) => param.reason === TagError.TAG_NAME_ALREADY_EXISTS);
