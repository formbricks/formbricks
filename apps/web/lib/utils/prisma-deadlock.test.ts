import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { isDeadlockError, retryOnDeadlock } from "./prisma-deadlock";

const p2034 = new Prisma.PrismaClientKnownRequestError("deadlock", {
  code: "P2034",
  clientVersion: "0.0.1",
});

describe("isDeadlockError", () => {
  test("matches a Prisma P2034 known request error", () => {
    expect(isDeadlockError(p2034)).toBe(true);
  });

  test("matches the driver-adapter shape by message (the ENG-2038 / ENG-2252 Sentry shape)", () => {
    expect(isDeadlockError(new Error("deadlock detected"))).toBe(true);
    expect(isDeadlockError(new Error("SQLSTATE 40P01"))).toBe(true);
  });

  test("does not match other errors or non-errors", () => {
    expect(isDeadlockError(new Error("boom"))).toBe(false);
    expect(
      isDeadlockError(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "0.0.1" })
      )
    ).toBe(false);
    expect(isDeadlockError("deadlock detected")).toBe(false);
    expect(isDeadlockError(undefined)).toBe(false);
  });
});

describe("retryOnDeadlock", () => {
  test("returns the result without retrying when the operation succeeds", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    await expect(retryOnDeadlock(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test("retries a deadlock and returns the next attempt's result", async () => {
    const operation = vi.fn().mockRejectedValueOnce(p2034).mockResolvedValueOnce("ok");

    await expect(retryOnDeadlock(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test("gives up after the max attempts when the deadlock persists", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("deadlock detected"));

    await expect(retryOnDeadlock(operation)).rejects.toThrow("deadlock detected");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test("does not retry a non-deadlock error", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(retryOnDeadlock(operation)).rejects.toThrow("boom");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
