import type { BetterAuthOptions } from "better-auth";
import { vi } from "vitest";

export const REDIS_ERROR = new Error("Socket closed unexpectedly");

export const createSecondaryStorageMock = () => {
  const values = new Map<string, string>();
  let failReads = false;

  return {
    storage: {
      get: vi.fn(async (key: string) => {
        if (failReads) throw REDIS_ERROR;
        return values.get(key) ?? null;
      }),
      getAndDelete: vi.fn(async (key: string) => {
        const value = values.get(key) ?? null;
        values.delete(key);
        return value;
      }),
      increment: vi.fn(async (key: string) => {
        const value = Number(values.get(key) ?? 0) + 1;
        values.set(key, String(value));
        return value;
      }),
      set: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    } satisfies BetterAuthOptions["secondaryStorage"],
    failReads: () => {
      failReads = true;
    },
  };
};
