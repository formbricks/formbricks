import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { VIEW_NAMES, type ViewName } from "./views";

test("every listed view has an entry document, and the type lists the same names", () => {
  const typed: Record<ViewName, true> = {
    "survey-preview": true,
    "document-review": true,
    "feedback-chart": true,
    responses: true,
    "creative-preview": true,
    workflow: true,
  };
  expect([...VIEW_NAMES].sort()).toEqual(Object.keys(typed).sort());
  for (const name of VIEW_NAMES) {
    expect(existsSync(path.join(__dirname, "views", name, "index.html"))).toBe(true);
  }
});
