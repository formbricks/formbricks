import { describe, expect, test, vi } from "vitest";
import { deleteInChunks } from "./delete-in-chunks";

describe("deleteInChunks", () => {
  test("deletes every id, at most a chunk at a time", async () => {
    let inFlight = 0;
    let peak = 0;
    const deleteOne = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    const result = await deleteInChunks(["a", "b", "c", "d", "e", "f", "g"], deleteOne, 3);

    expect(result).toEqual({ deleted: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(deleteOne).toHaveBeenCalledTimes(7);
    expect(peak).toBe(3);
  });

  test("on a failure, reports what was deleted, the failure, and starts no later chunk", async () => {
    const refusal = new Error("429");
    const deleteOne = vi.fn(async (id: string) => {
      if (id === "e") throw refusal;
    });

    const result = await deleteInChunks(["a", "b", "c", "d", "e", "f", "g"], deleteOne, 3);

    // The failing chunk's other ids did go: the server deleted them.
    expect(result).toEqual({ deleted: ["a", "b", "c", "d", "f"], error: refusal });
    expect(deleteOne).not.toHaveBeenCalledWith("g");
  });

  test("deletes nothing for no ids", async () => {
    const deleteOne = vi.fn();

    expect(await deleteInChunks([], deleteOne, 5)).toEqual({ deleted: [] });
    expect(deleteOne).not.toHaveBeenCalled();
  });
});
