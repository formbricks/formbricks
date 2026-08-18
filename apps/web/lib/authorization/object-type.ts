import "server-only";
import type { TAuthorizationActor, TAuthorizationResourceType } from "./contract";

type TAuthorizationObjectType = TAuthorizationActor["type"] | TAuthorizationResourceType;

const SPICEDB_OBJECT_TYPE_MAP = {
  apiKey: "api_key",
  feedbackDirectory: "feedback_directory",
  feedbackDirectoryAssignment: "feedback_directory_assignment",
} as const satisfies Partial<Record<TAuthorizationObjectType, string>>;

/** Map Formbricks-owned authorization names to their SpiceDB schema definitions. */
export const getSpicedbObjectType = (type: TAuthorizationObjectType): string =>
  SPICEDB_OBJECT_TYPE_MAP[type as keyof typeof SPICEDB_OBJECT_TYPE_MAP] ?? type;
