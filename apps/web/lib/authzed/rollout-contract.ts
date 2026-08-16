/**
 * Bounded rollout targets for the current server-side authorization surfaces.
 *
 * This file deliberately contains no runtime configuration. `env.ts` imports it
 * while building the server environment schema, so it must remain a pure
 * contract rather than importing the server-only authorization runtime.
 */
export const AUTHZED_AUTHORIZATION_ROLLOUT_TARGETS = [
  "server_action:user",
  "api_v1:user",
  "api_v1:apiKey",
  "api_v2:apiKey",
  "api_v3:user",
  "api_v3:apiKey",
  "mcp:user",
  "mcp:apiKey",
  "feedback_gateway:user",
  "feedback_gateway:apiKey",
] as const;

export type TAuthzedAuthorizationRolloutTarget = (typeof AUTHZED_AUTHORIZATION_ROLLOUT_TARGETS)[number];

export type TAuthzedAuthorizationRolloutSurface =
  TAuthzedAuthorizationRolloutTarget extends `${infer TSurface}:${string}` ? TSurface : never;

export const isAuthzedAuthorizationRolloutTarget = (
  value: string
): value is TAuthzedAuthorizationRolloutTarget =>
  (AUTHZED_AUTHORIZATION_ROLLOUT_TARGETS as readonly string[]).includes(value);

export const getAuthzedAuthorizationRolloutSurface = (
  target: TAuthzedAuthorizationRolloutTarget
): TAuthzedAuthorizationRolloutSurface =>
  target.slice(0, target.indexOf(":")) as TAuthzedAuthorizationRolloutSurface;
