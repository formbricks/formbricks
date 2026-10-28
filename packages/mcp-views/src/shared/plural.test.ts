import { expect, test } from "vitest";
import { plural } from "./plural";

test("plural picks the singular only for exactly one", () => {
  expect(plural(1, "response")).toBe("1 response");
  expect(plural(0, "response")).toBe("0 responses");
  expect(plural(2, "reply", "replies")).toBe("2 replies");
});
