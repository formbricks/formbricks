import { vi } from "vitest";

export const sdkMocks = {
  close: vi.fn(),
  deadlineInterceptor: vi.fn((timeoutMs: number) => ({ timeoutMs })),
  deleteRelationships: vi.fn(),
  diffSchema: vi.fn(),
  newClient: vi.fn(),
  readRelationships: vi.fn(),
  readSchema: vi.fn(),
  writeRelationships: vi.fn(),
  writeSchema: vi.fn(),
};

export const configMocks = {
  isAuthzedEnabled: vi.fn(),
};

export const envMock = {
  AUTHZED_CONSISTENCY: undefined as "minimize_latency" | "fully_consistent" | undefined,
  AUTHZED_ENDPOINT: "spicedb:50051" as string | undefined,
  AUTHZED_INSECURE: "true" as "true" | "false" | "1" | "0" | undefined,
  AUTHZED_SYSTEM_KEY: "formbricks" as string | undefined,
  AUTHZED_TOKEN: "private-token" as string | undefined,
};

export const retryMocks = {
  execute: vi.fn((_operation: string, request: () => Promise<unknown>) => request()),
};

vi.mock("@authzed/authzed-node", () => ({
  deadlineInterceptor: sdkMocks.deadlineInterceptor,
  v1: {
    ClientSecurity: {
      INSECURE_PLAINTEXT_CREDENTIALS: 2,
      SECURE: 0,
    },
    // Mirrors the real enum. A mock that omitted it would make the facade's completeness assertion
    // throw a TypeError instead of exercising it.
    DeleteRelationshipsResponse_DeletionProgress: {
      COMPLETE: 1,
      PARTIAL: 2,
      UNSPECIFIED: 0,
    },
    NewClient: sdkMocks.newClient,
    RelationshipUpdate_Operation: {
      DELETE: 3,
      TOUCH: 2,
    },
  },
}));

vi.mock("@/lib/env", () => ({ env: envMock }));

vi.mock("../config", () => ({
  isAuthzedEnabled: configMocks.isAuthzedEnabled,
}));

vi.mock("../retry", () => ({
  executeAuthzedOperation: retryMocks.execute,
}));
