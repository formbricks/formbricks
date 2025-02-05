import { setAttributes } from "@/lib/user/attribute";
import { UpdateQueue } from "@/lib/user/update-queue";
import { beforeEach, describe, expect, test, vi } from "vitest";

export const mockAttributes = {
  name: "John Doe",
  email: "john@example.com",
};

// Mock the UpdateQueue
vi.mock("@/lib/user/update-queue", () => ({
  UpdateQueue: {
    getInstance: vi.fn(() => ({
      updateAttributes: vi.fn(),
      processUpdates: vi.fn(),
    })),
  },
}));

describe("User Attributes", () => {
  const mockUpdateQueue = {
    updateAttributes: vi.fn(),
    processUpdates: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const getInstanceUpdateQueue = vi.spyOn(UpdateQueue, "getInstance");
    getInstanceUpdateQueue.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);
  });

  describe("setAttributes", () => {
    test("successfully updates attributes and triggers processing", async () => {
      const result = await setAttributes(mockAttributes);

      // Verify UpdateQueue methods were called correctly
      expect(mockUpdateQueue.updateAttributes).toHaveBeenCalledWith(mockAttributes);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();

      // Verify result is ok
      expect(result.ok).toBe(true);
    });

    test("processes multiple attribute updates", async () => {
      const firstAttributes = { name: mockAttributes.name };
      const secondAttributes = { email: mockAttributes.email };

      await setAttributes(firstAttributes);
      await setAttributes(secondAttributes);

      expect(mockUpdateQueue.updateAttributes).toHaveBeenCalledTimes(2);
      expect(mockUpdateQueue.updateAttributes).toHaveBeenNthCalledWith(1, firstAttributes);
      expect(mockUpdateQueue.updateAttributes).toHaveBeenNthCalledWith(2, secondAttributes);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalledTimes(2);
    });

    test("processes updates asynchronously", async () => {
      const attributes = { name: mockAttributes.name };

      // Mock processUpdates to be async
      mockUpdateQueue.processUpdates.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100);
          })
      );

      const result = await setAttributes(attributes);

      expect(result.ok).toBe(true);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();
      // The function returns before processUpdates completes due to void operator
    });
  });
});
