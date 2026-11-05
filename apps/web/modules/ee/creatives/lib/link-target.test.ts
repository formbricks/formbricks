import { describe, expect, test } from "vitest";
import { getLinkTargetLabel } from "./link-target";

describe("getLinkTargetLabel", () => {
  test("names a link to a site's root by its host", () => {
    expect(getLinkTargetLabel("https://status.northwind.example")).toBe("status.northwind.example");
    expect(getLinkTargetLabel("https://status.northwind.example/")).toBe("status.northwind.example");
  });

  test("adds the path when the link goes below the root", () => {
    expect(getLinkTargetLabel("https://www.northwind.example/plans/gold?ref=tab#costs")).toBe(
      "www.northwind.example/plans/gold"
    );
  });

  test("keeps a value that isn't a full URL as it is", () => {
    expect(getLinkTargetLabel("/pricing")).toBe("/pricing");
  });
});
