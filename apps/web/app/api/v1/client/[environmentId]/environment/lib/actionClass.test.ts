import { cache } from "@/lib/cache";
import { validateInputs } from "@/lib/utils/validate";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";
import { TJsEnvironmentStateActionClass } from "@formbricks/types/js";
import { getActionClassesForEnvironmentState } from "./actionClass";

// Mock dependencies
vi.mock("@/lib/cache");
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      findMany: vi.fn(),
    },
  },
}));

const environmentId = "test-environment-id";
const mockActionClasses: TJsEnvironmentStateActionClass[] = [
  {
    id: "action1",
    type: "code",
    name: "Code Action",
    key: "code-action",
    noCodeConfig: null,
  },
  {
    id: "action2",
    type: "noCode",
    name: "No Code Action",
    key: null,
    noCodeConfig: { type: "click" } as TActionClassNoCodeConfig,
  },
];

describe("getActionClassesForEnvironmentState", () => {
  test("should return action classes successfully", async () => {
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });

    const result = await getActionClassesForEnvironmentState(environmentId);

    expect(result).toEqual(mockActionClasses);
    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]); // ZId is an object
    expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
      where: { environmentId },
      select: {
        id: true,
        type: true,
        name: true,
        key: true,
        noCodeConfig: true,
      },
    });
    expect(cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`getActionClassesForEnvironmentState-${environmentId}`],
      { tags: [`environments-${environmentId}-actionClasses`] }
    );
  });

  test("should throw DatabaseError on prisma error", async () => {
    const mockError = new Error("Prisma error");
    vi.mocked(prisma.actionClass.findMany).mockRejectedValue(mockError);
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });

    await expect(getActionClassesForEnvironmentState(environmentId)).rejects.toThrow(DatabaseError);
    await expect(getActionClassesForEnvironmentState(environmentId)).rejects.toThrow(
      `Database error when fetching actions for environment ${environmentId}`
    );
    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
    expect(prisma.actionClass.findMany).toHaveBeenCalled();
    expect(cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`getActionClassesForEnvironmentState-${environmentId}`],
      { tags: [`environments-${environmentId}-actionClasses`] }
    );
  });
});
