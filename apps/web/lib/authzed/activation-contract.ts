import "server-only";
import { createHash } from "node:crypto";
import { AUTHORIZATION_PERMISSION_MAP } from "@/lib/authorization/contract";
import { env } from "@/lib/env";
import { AUTHZED_CLIENT_CONTRACT_VERSION, type TAuthzedDigest } from "./activation-types";
import { isAuthzedEnabled } from "./config";
import { readCanonicalAuthzedSchema } from "./schema-source";

const digest = (value: string): TAuthzedDigest =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const getAuthzedAuthorizationContractDigest = (): TAuthzedDigest => {
  const permissions = Object.entries(AUTHORIZATION_PERMISSION_MAP)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, permissions]) => [resource, [...permissions].sort()] as const);
  return digest(JSON.stringify({ clientContractVersion: AUTHZED_CLIENT_CONTRACT_VERSION, permissions }));
};

export const getCanonicalAuthzedSchemaDigest = async (): Promise<TAuthzedDigest> =>
  digest(await readCanonicalAuthzedSchema());

/**
 * Bind the receipt to both decision invariants and the configured SpiceDB target identity. Token and
 * TLS rotation can happen in place without changing the graph, so they are deliberately excluded.
 * Endpoint or namespace changes require a fenced activation refresh; admitting them under an old
 * receipt could start against an empty or stale datastore that merely happens to be reachable.
 */
export const getAuthzedClientConfigDigest = (): TAuthzedDigest =>
  digest(
    JSON.stringify({
      consistency: env.AUTHZED_CONSISTENCY ?? "minimize_latency",
      enabled: isAuthzedEnabled(),
      endpoint: env.AUTHZED_ENDPOINT ?? null,
      systemKey: env.AUTHZED_SYSTEM_KEY ?? null,
    })
  );
