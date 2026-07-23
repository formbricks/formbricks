import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type TAuthzedClient, getAuthzedClient } from "./client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

type TAuthzedSchemaDigest = `sha256:${string}`;

type TAuthzedSchemaState = Readonly<{
  remoteDigest: TAuthzedSchemaDigest | null;
  remoteState: "empty" | "present";
  sourceDigest: TAuthzedSchemaDigest;
}>;

export type TAuthzedSchemaCheckResult =
  | (TAuthzedSchemaState &
      Readonly<{
        differenceCount: 0;
        differenceKinds: Readonly<Record<string, never>>;
        remoteDigest: TAuthzedSchemaDigest;
        remoteState: "present";
        status: "matched";
      }>)
  | (TAuthzedSchemaState &
      Readonly<{
        differenceCount: number;
        differenceKinds: Readonly<Record<string, number>>;
        status: "drifted";
      }>);

export type TAuthzedSchemaApplyResult = TAuthzedSchemaState &
  Readonly<{
    differenceCount: 0;
    status: "applied" | "unchanged";
  }>;

type TAuthzedSchemaDependencies = Readonly<{
  getClient: () => Pick<TAuthzedClient, "diffSchema" | "readSchema" | "writeSchema">;
  readCanonicalSchema: () => Promise<string>;
}>;

const canonicalSchemaUrl = new URL("../../../../authzed/schema.zed", import.meta.url);

const readCanonicalSchema = async (): Promise<string> => readFile(canonicalSchemaUrl, "utf8");

const defaultDependencies: TAuthzedSchemaDependencies = {
  getClient: getAuthzedClient,
  readCanonicalSchema,
};

const createSchemaDigest = (schemaText: string): TAuthzedSchemaDigest =>
  `sha256:${createHash("sha256").update(schemaText).digest("hex")}`;

const loadCanonicalSchema = async (
  dependencies: TAuthzedSchemaDependencies
): Promise<Readonly<{ digest: TAuthzedSchemaDigest; schemaText: string }>> => {
  try {
    const schemaText = await dependencies.readCanonicalSchema();

    if (schemaText.trim().length === 0) {
      throw new Error("Canonical schema is empty");
    }

    return {
      digest: createSchemaDigest(schemaText),
      schemaText,
    };
  } catch (error) {
    throw new AuthzedError({
      attempts: 1,
      cause: error,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "load_canonical_schema",
      retryable: false,
    });
  }
};

const compareSchema = async (
  dependencies: TAuthzedSchemaDependencies,
  canonicalSchema: Readonly<{ digest: TAuthzedSchemaDigest; schemaText: string }>
): Promise<TAuthzedSchemaCheckResult> => {
  const client = dependencies.getClient();
  const { schemaText: remoteSchemaText } = await client.readSchema();

  if (remoteSchemaText.length === 0) {
    return {
      differenceCount: 1,
      differenceKinds: { schema_missing: 1 },
      remoteDigest: null,
      remoteState: "empty",
      sourceDigest: canonicalSchema.digest,
      status: "drifted",
    };
  }

  const remoteDigest = createSchemaDigest(remoteSchemaText);
  const differences = await client.diffSchema(canonicalSchema.schemaText);

  if (differences.differenceCount === 0) {
    return {
      differenceCount: 0,
      differenceKinds: {},
      remoteDigest,
      remoteState: "present",
      sourceDigest: canonicalSchema.digest,
      status: "matched",
    };
  }

  return {
    ...differences,
    remoteDigest,
    remoteState: "present",
    sourceDigest: canonicalSchema.digest,
    status: "drifted",
  };
};

export const checkCanonicalAuthzedSchema = async (
  dependencyOverrides: Partial<TAuthzedSchemaDependencies> = {}
): Promise<TAuthzedSchemaCheckResult> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const canonicalSchema = await loadCanonicalSchema(dependencies);

  return compareSchema(dependencies, canonicalSchema);
};

export const applyCanonicalAuthzedSchema = async (
  expectedCurrentDigest?: string,
  dependencyOverrides: Partial<TAuthzedSchemaDependencies> = {}
): Promise<TAuthzedSchemaApplyResult> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const canonicalSchema = await loadCanonicalSchema(dependencies);
  const currentState = await compareSchema(dependencies, canonicalSchema);

  if (currentState.status === "matched") {
    return {
      differenceCount: 0,
      remoteDigest: currentState.remoteDigest,
      remoteState: currentState.remoteState,
      sourceDigest: currentState.sourceDigest,
      status: "unchanged",
    };
  }

  const preconditionSatisfied =
    currentState.remoteState === "empty"
      ? expectedCurrentDigest === undefined
      : expectedCurrentDigest === currentState.remoteDigest;

  if (!preconditionSatisfied) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.SCHEMA_CHANGED,
      operation: "write_schema_precondition",
      retryable: false,
    });
  }

  await dependencies.getClient().writeSchema(canonicalSchema.schemaText);

  const verifiedState = await compareSchema(dependencies, canonicalSchema);

  if (verifiedState.status !== "matched") {
    throw new AuthzedError({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.SCHEMA_VERIFICATION_FAILED,
      operation: "verify_written_schema",
      retryable: false,
    });
  }

  return {
    differenceCount: 0,
    remoteDigest: verifiedState.remoteDigest,
    remoteState: verifiedState.remoteState,
    sourceDigest: verifiedState.sourceDigest,
    status: "applied",
  };
};
