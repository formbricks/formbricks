import { vi } from "vitest";

export const sdkMocks = {
  close: vi.fn(),
  deadlineInterceptor: vi.fn((timeoutMs: number) => ({ timeoutMs })),
  newClient: vi.fn(),
  readSchema: vi.fn(),
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
    NewClient: sdkMocks.newClient,
  },
}));

vi.mock("@/lib/env", () => ({ env: envMock }));

vi.mock("../config", () => ({
  isAuthzedEnabled: configMocks.isAuthzedEnabled,
}));

vi.mock("../retry", () => ({
  executeAuthzedOperation: retryMocks.execute,
}));
