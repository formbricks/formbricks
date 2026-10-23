import { describe, expect, test } from "vitest";
import { loggableError, stackFrames } from "./loggable-error";

const SECRET = "wording-from-the-file";

describe("stackFrames", () => {
  test("returns the frames under the header, and no line of a multi-line message", () => {
    const error = new Error(`Failed on ${SECRET}\n    at ${SECRET} (looks:1:1)`);

    const frames = stackFrames(error);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.join("\n")).toContain("loggable-error.test.ts");
    expect(frames.join("\n")).not.toContain(SECRET);
  });

  test("keeps the frames of Node's coded errors, whose header carries the code", () => {
    const error = Object.assign(new TypeError("Invalid state: Controller is already closed"), {
      code: "ERR_INVALID_STATE",
    });
    // As Node prints it; Vitest rewrites stacks without the code.
    error.stack = [
      "TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed",
      "    at emit (/app/stream.ts:1:1)",
    ].join("\n");

    expect(stackFrames(error)).toEqual(["    at emit (/app/stream.ts:1:1)"]);
  });

  test("returns no frames when the message changed after the stack was read", () => {
    const error = new Error(`Failed\n    at ${SECRET} (looks:1:1)`);
    void error.stack;
    error.message = "rewritten";

    expect(stackFrames(error)).toEqual([]);
  });

  test("returns no frames for a message that is not a string, without throwing", () => {
    const error = new Error("boom");
    Object.defineProperty(error, "message", { value: undefined });

    expect(stackFrames(error)).toEqual([]);
  });

  test("handles an empty message, whose header is the name alone", () => {
    const error = new Error("");
    // As Node prints it; Vitest rewrites this header as "Error: ".
    error.stack = ["Error", "    at run (/app/job.ts:1:1)"].join("\n");

    expect(stackFrames(error)).toEqual(["    at run (/app/job.ts:1:1)"]);
  });
});

describe("loggableError", () => {
  test("logs an error by name and frames, never its message", () => {
    const logged = loggableError(new RangeError(SECRET));

    expect(logged).toMatchObject({
      errName: "RangeError",
      errStack: expect.stringMatching(/^ +at \S.*(?:\n +at \S.*)*$/),
    });
    expect(JSON.stringify(logged)).not.toContain(SECRET);
  });

  test("logs only the type of something thrown that is not an Error", () => {
    expect(loggableError(SECRET)).toEqual({ errType: "string" });
  });
});
