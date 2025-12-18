import { beforeEach, describe, expect, test, vi } from "vitest";
import { setAttributes } from "@/lib/user/attribute";
import { UpdateQueue } from "@/lib/user/update-queue";

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

// Mock the Logger
vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      error: vi.fn(),
      debug: vi.fn(),
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
      mockUpdateQueue.processUpdates.mockResolvedValue(undefined);

      const result = await setAttributes(mockAttributes);

      // Verify UpdateQueue methods were called correctly
      expect(mockUpdateQueue.updateAttributes).toHaveBeenCalledWith(mockAttributes);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();

      // Verify result is ok
      expect(result.ok).toBe(true);
    });

    test("processes multiple attribute updates", async () => {
      mockUpdateQueue.processUpdates.mockResolvedValue(undefined);

      const firstAttributes = { name: mockAttributes.name };
      const secondAttributes = { email: mockAttributes.email };

      await setAttributes(firstAttributes);
      await setAttributes(secondAttributes);

      expect(mockUpdateQueue.updateAttributes).toHaveBeenCalledTimes(2);
      expect(mockUpdateQueue.updateAttributes).toHaveBeenNthCalledWith(1, firstAttributes);
      expect(mockUpdateQueue.updateAttributes).toHaveBeenNthCalledWith(2, secondAttributes);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalledTimes(2);
    });

    test("waits for processUpdates to complete", async () => {
      const attributes = { name: mockAttributes.name };
      let processUpdatesResolved = false;

      // Mock processUpdates to be async and set a flag when resolved
      mockUpdateQueue.processUpdates.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              processUpdatesResolved = true;
              resolve(undefined);
            }, 100);
          })
      );

      const resultPromise = setAttributes(attributes);

      // Verify processUpdates was called
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();

      // Verify the function hasn't resolved yet
      expect(processUpdatesResolved).toBe(false);

      // Wait for setAttributes to complete
      const result = await resultPromise;

      // Verify it completed after processUpdates
      expect(processUpdatesResolved).toBe(true);
      expect(result.ok).toBe(true);
    });
  });
});
