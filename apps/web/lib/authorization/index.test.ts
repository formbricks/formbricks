import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan, can } from ".";
import type { TAuthorizationActor, TAuthorizationResource } from "./contract";
import { legacyEvaluator } from "./legacy-evaluator";

// Stub the evaluator so these tests exercise only the public interface + selection point.
vi.mock("./legacy-evaluator", () => ({ legacyEvaluator: { can: vi.fn() } }));

const ACTOR: TAuthorizationActor = { type: "user", id: "user1" };
const RESOURCE: TAuthorizationResource = { type: "survey", id: "survey1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorization public interface", () => {
  test("can delegates to the selected evaluator and returns its decision", async () => {
    vi.mocked(legacyEvaluator.can).mockResolvedValue(true);
    await expect(can(ACTOR, "survey.read", RESOURCE)).resolves.toBe(true);
    expect(legacyEvaluator.can).toHaveBeenCalledWith(ACTOR, "survey.read", RESOURCE);
  });

  test("assertCan resolves when the evaluator allows", async () => {
    vi.mocked(legacyEvaluator.can).mockResolvedValue(true);
    await expect(assertCan(ACTOR, "survey.read", RESOURCE)).resolves.toBeUndefined();
  });

  test("assertCan throws AuthorizationError when the evaluator denies", async () => {
    vi.mocked(legacyEvaluator.can).mockResolvedValue(false);
    await expect(assertCan(ACTOR, "survey.read", RESOURCE)).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("assertCan propagates an evaluator failure without turning it into a denial", async () => {
    vi.mocked(legacyEvaluator.can).mockRejectedValue(new Error("db down"));
    await expect(assertCan(ACTOR, "survey.read", RESOURCE)).rejects.toThrow("db down");
  });
});
