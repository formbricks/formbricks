import { describe, expect, test } from "vitest";
import { tidyCss } from "./tidy";

describe("tidyCss", () => {
  test("puts one declaration per line, indented by two spaces, with no trailing newline", async () => {
    await expect(tidyCss('[data-fb-part="headline"]{color:#10283a;font-weight:600}')).resolves.toBe(
      '[data-fb-part="headline"] {\n  color: #10283a;\n  font-weight: 600;\n}'
    );
  });

  test("leaves an empty field alone", async () => {
    await expect(tidyCss("  \n")).resolves.toBe("  \n");
  });

  test("rejects CSS it cannot parse instead of rewriting it", async () => {
    await expect(tidyCss("a { color: red;")).rejects.toThrow();
  });
});
