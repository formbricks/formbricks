import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { applyCanonicalAuthzedSchema, checkCanonicalAuthzedSchema } from "./schema";

vi.mock("./client", () => ({ getAuthzedClient: vi.fn() }));

const canonicalSchema = "definition user {}\n";
const remoteSchema = "definition document {}\n";
const digest = (schemaText: string): string =>
  `sha256:${createHash("sha256").update(schemaText).digest("hex")}`;

const createDependencies = () => ({
  diffSchema: vi.fn(),
  readCanonicalSchema: vi.fn().mockResolvedValue(canonicalSchema),
  readSchema: vi.fn(),
  writeSchema: vi.fn(),
});

describe("canonical AuthZed schema lifecycle", () => {
  let dependencies: ReturnType<typeof createDependencies>;

  beforeEach(() => {
    dependencies = createDependencies();
  });

  const overrides = () => ({
    getClient: () => ({
      diffSchema: dependencies.diffSchema,
      readSchema: dependencies.readSchema,
      writeSchema: dependencies.writeSchema,
    }),
    readCanonicalSchema: dependencies.readCanonicalSchema,
  });

  test("reports an empty SpiceDB installation as drift without diffing", async () => {
    dependencies.readSchema.mockResolvedValue({ schemaText: "" });

    await expect(checkCanonicalAuthzedSchema(overrides())).resolves.toEqual({
      differenceCount: 1,
      differenceKinds: { schema_missing: 1 },
      remoteDigest: null,
      remoteState: "empty",
      sourceDigest: digest(canonicalSchema),
      status: "drifted",
    });
    expect(dependencies.diffSchema).not.toHaveBeenCalled();
  });

  test("uses semantic differences instead of raw text equality", async () => {
    dependencies.readSchema.mockResolvedValue({ schemaText: `${canonicalSchema}\n` });
    dependencies.diffSchema.mockResolvedValue({ differenceCount: 0, differenceKinds: {} });

    await expect(checkCanonicalAuthzedSchema(overrides())).resolves.toEqual({
      differenceCount: 0,
      differenceKinds: {},
      remoteDigest: digest(`${canonicalSchema}\n`),
      remoteState: "present",
      sourceDigest: digest(canonicalSchema),
      status: "matched",
    });
    expect(dependencies.diffSchema).toHaveBeenCalledWith(canonicalSchema);
  });

  test("reports only aggregate semantic drift and content digests", async () => {
    dependencies.readSchema.mockResolvedValue({ schemaText: remoteSchema });
    dependencies.diffSchema.mockResolvedValue({
      differenceCount: 2,
      differenceKinds: { definition_added: 1, definition_removed: 1 },
    });

    await expect(checkCanonicalAuthzedSchema(overrides())).resolves.toEqual({
      differenceCount: 2,
      differenceKinds: { definition_added: 1, definition_removed: 1 },
      remoteDigest: digest(remoteSchema),
      remoteState: "present",
      sourceDigest: digest(canonicalSchema),
      status: "drifted",
    });
  });

  test("rejects an empty or unreadable canonical source with a stable sanitized error", async () => {
    const secretPath = "/private/never-log-this-token";
    dependencies.readCanonicalSchema.mockRejectedValue(new Error(secretPath));

    const result = await checkCanonicalAuthzedSchema(overrides()).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(AuthzedError);
    expect(result).toMatchObject({
      code: AUTHZED_ERROR_CODES.INTERNAL,
      message: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "load_canonical_schema",
      retryable: false,
    });
    expect((result as Error).message).not.toContain(secretPath);

    dependencies.readCanonicalSchema.mockResolvedValue(" \n");
    await expect(checkCanonicalAuthzedSchema(overrides())).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.INTERNAL,
    });
  });

  test("applies to an empty installation and verifies semantic convergence", async () => {
    dependencies.readSchema
      .mockResolvedValueOnce({ schemaText: "" })
      .mockResolvedValueOnce({ schemaText: canonicalSchema });
    dependencies.diffSchema.mockResolvedValue({ differenceCount: 0, differenceKinds: {} });

    await expect(applyCanonicalAuthzedSchema(undefined, overrides())).resolves.toEqual({
      differenceCount: 0,
      remoteDigest: digest(canonicalSchema),
      remoteState: "present",
      sourceDigest: digest(canonicalSchema),
      status: "applied",
    });
    expect(dependencies.writeSchema).toHaveBeenCalledOnce();
    expect(dependencies.writeSchema).toHaveBeenCalledWith(canonicalSchema);
  });

  test("returns unchanged without writing when the remote schema already matches", async () => {
    dependencies.readSchema.mockResolvedValue({ schemaText: canonicalSchema });
    dependencies.diffSchema.mockResolvedValue({ differenceCount: 0, differenceKinds: {} });

    await expect(applyCanonicalAuthzedSchema(undefined, overrides())).resolves.toEqual({
      differenceCount: 0,
      remoteDigest: digest(canonicalSchema),
      remoteState: "present",
      sourceDigest: digest(canonicalSchema),
      status: "unchanged",
    });
    expect(dependencies.writeSchema).not.toHaveBeenCalled();
  });

  test("requires the reviewed current digest before replacing non-empty drift", async () => {
    dependencies.readSchema.mockResolvedValue({ schemaText: remoteSchema });
    dependencies.diffSchema.mockResolvedValue({
      differenceCount: 1,
      differenceKinds: { definition_removed: 1 },
    });

    await expect(applyCanonicalAuthzedSchema(undefined, overrides())).rejects.toMatchObject({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.SCHEMA_CHANGED,
      operation: "write_schema_precondition",
      retryable: false,
    });
    await expect(applyCanonicalAuthzedSchema("sha256:incorrect", overrides())).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.SCHEMA_CHANGED,
    });
    expect(dependencies.writeSchema).not.toHaveBeenCalled();
  });

  test("replaces reviewed drift and verifies the resulting schema", async () => {
    dependencies.readSchema
      .mockResolvedValueOnce({ schemaText: remoteSchema })
      .mockResolvedValueOnce({ schemaText: canonicalSchema });
    dependencies.diffSchema
      .mockResolvedValueOnce({
        differenceCount: 1,
        differenceKinds: { definition_removed: 1 },
      })
      .mockResolvedValueOnce({ differenceCount: 0, differenceKinds: {} });

    await expect(applyCanonicalAuthzedSchema(digest(remoteSchema), overrides())).resolves.toMatchObject({
      differenceCount: 0,
      status: "applied",
    });
    expect(dependencies.writeSchema).toHaveBeenCalledWith(canonicalSchema);
  });

  test("fails closed when read-back verification still detects drift", async () => {
    dependencies.readSchema
      .mockResolvedValueOnce({ schemaText: "" })
      .mockResolvedValueOnce({ schemaText: remoteSchema });
    dependencies.diffSchema.mockResolvedValue({
      differenceCount: 1,
      differenceKinds: { definition_removed: 1 },
    });

    await expect(applyCanonicalAuthzedSchema(undefined, overrides())).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.SCHEMA_VERIFICATION_FAILED,
      operation: "verify_written_schema",
      retryable: false,
    });
  });
});
