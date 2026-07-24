import "server-only";

/**
 * Current Formbricks authorization vocabulary.
 *
 * This map is the application source of truth for valid resource/permission
 * combinations. Keep it independent from AuthZed SDK and schema types.
 *
 * @internal Import the public types from "@/lib/authorization".
 */
export const AUTHORIZATION_PERMISSION_MAP = {
  apiKey: ["read", "manage"],
  organization: [
    "read",
    "write",
    "manage",
    "manage_billing",
    "read_access",
    "manage_access",
    "manage_api_keys",
  ],
  team: ["read", "manage", "delete"],
  workspace: ["read", "write", "manage", "share"],
  survey: ["read", "write", "manage", "delete", "publish", "response_read", "response_export"],
  dashboard: ["read", "write"],
  response: ["read", "write", "manage", "export"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

type TAuthorizationPermissionMap = {
  readonly [TResourceType in keyof typeof AUTHORIZATION_PERMISSION_MAP]: (typeof AUTHORIZATION_PERMISSION_MAP)[TResourceType][number];
};

export type TAuthorizationResourceType = keyof TAuthorizationPermissionMap;

export type TAuthorizationActor =
  | Readonly<{
      type: "user";
      id: string;
    }>
  | Readonly<{
      type: "apiKey";
      id: string;
    }>;

type TAuthorizationResourceOfType<TResourceType extends TAuthorizationResourceType> =
  TResourceType extends TAuthorizationResourceType
    ? Readonly<{
        type: TResourceType;
        id: string;
      }>
    : never;

export type TAuthorizationResource = TAuthorizationResourceOfType<TAuthorizationResourceType>;

export type TAuthorizationAction = {
  [TResourceType in TAuthorizationResourceType]: `${TResourceType}.${TAuthorizationPermissionMap[TResourceType]}`;
}[TAuthorizationResourceType];

type TAuthorizationResourceTypeForAction<TAction extends TAuthorizationAction> =
  TAction extends `${infer TResourceType extends TAuthorizationResourceType}.${string}`
    ? TResourceType
    : never;

export type TAuthorizationResourceForAction<TAction extends TAuthorizationAction> =
  TAuthorizationResourceOfType<TAuthorizationResourceTypeForAction<TAction>>;
