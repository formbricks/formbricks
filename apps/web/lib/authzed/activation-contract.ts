import "server-only";
import { createHash } from "node:crypto";
import { AUTHORIZATION_PERMISSION_MAP } from "@/lib/authorization/contract";
import { env } from "@/lib/env";
import { AUTHZED_CLIENT_CONTRACT_VERSION, type TAuthzedDigest } from "./activation-types";
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
 * Bind activation to the non-secret connection contract. The credential is deliberately excluded:
 * rotating it must not invalidate the graph, while changing endpoint, namespace, TLS, or consistency
 * requires a fresh receipt.
 */
export const getAuthzedClientConfigDigest = (): TAuthzedDigest =>
  digest(
    JSON.stringify({
      consistency: env.AUTHZED_CONSISTENCY ?? "minimize_latency",
      endpoint: env.AUTHZED_ENDPOINT ?? null,
      insecure: env.AUTHZED_INSECURE === "true" || env.AUTHZED_INSECURE === "1",
      systemKey: env.AUTHZED_SYSTEM_KEY ?? null,
    })
  );
