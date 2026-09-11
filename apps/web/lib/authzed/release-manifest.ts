import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  AUTHZED_ACTIVATION_PROTOCOL_VERSION,
  AUTHZED_CLIENT_CONTRACT_VERSION,
  type TAuthzedDigest,
} from "./activation-types";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

export type TAuthzedReleaseMode = "legacy_bridge" | "spicedb_authoritative";

export type TAuthzedReleaseManifest = Readonly<{
  authorizationMode: TAuthzedReleaseMode;
  clientContractVersion: number;
  migrationHead: string;
  protocolVersion: number;
  sourceRevision: string;
}>;

const defaultReleaseManifestUrl = new URL(
  "../../../../release/authzed-runtime-manifest.json",
  import.meta.url
);

const globalForAuthzedReleaseManifest = globalThis as typeof globalThis & {
  authzedReleaseManifestUrl?: URL;
};

const isReleaseMode = (value: unknown): value is TAuthzedReleaseMode =>
  value === "legacy_bridge" || value === "spicedb_authoritative";

const MIGRATION_HEAD_PATTERN = /^\d{14}_[a-z0-9][a-z0-9_]{0,95}$/;
const SOURCE_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const invalidManifest = (cause?: unknown): AuthzedError =>
  new AuthzedError({
    attempts: 0,
    cause,
    code: AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED,
    operation: "activation_release_manifest",
    retryable: false,
  });

export const configureAuthzedReleaseManifestUrl = (moduleUrl: string, relativePath: string): void => {
  globalForAuthzedReleaseManifest.authzedReleaseManifestUrl = new URL(relativePath, moduleUrl);
};

export const readAuthzedReleaseManifest = async (): Promise<TAuthzedReleaseManifest> => {
  try {
    const serialized = await readFile(
      globalForAuthzedReleaseManifest.authzedReleaseManifestUrl ?? defaultReleaseManifestUrl,
      "utf8"
    );
    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("authorizationMode" in parsed) ||
      !isReleaseMode(parsed.authorizationMode) ||
      !("clientContractVersion" in parsed) ||
      !Number.isSafeInteger(parsed.clientContractVersion) ||
      parsed.clientContractVersion !== AUTHZED_CLIENT_CONTRACT_VERSION ||
      !("migrationHead" in parsed) ||
      typeof parsed.migrationHead !== "string" ||
      !MIGRATION_HEAD_PATTERN.test(parsed.migrationHead) ||
      !("protocolVersion" in parsed) ||
      parsed.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
      !("sourceRevision" in parsed) ||
      typeof parsed.sourceRevision !== "string" ||
      !SOURCE_REVISION_PATTERN.test(parsed.sourceRevision)
    ) {
      throw invalidManifest();
    }

    return {
      authorizationMode: parsed.authorizationMode,
      clientContractVersion: parsed.clientContractVersion,
      migrationHead: parsed.migrationHead,
      protocolVersion: parsed.protocolVersion,
      sourceRevision: parsed.sourceRevision,
    };
  } catch (error) {
    if (error instanceof AuthzedError) throw error;
    throw invalidManifest(error);
  }
};

export const createAuthzedReleaseManifestDigest = (manifest: TAuthzedReleaseManifest): TAuthzedDigest =>
  `sha256:${createHash("sha256").update(JSON.stringify(manifest)).digest("hex")}`;
