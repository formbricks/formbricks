import { describe, expect, test, vi } from "vitest";
import { EditMemberships } from "./edit-memberships";
import { EditMemberships as ExportedEditMemberships } from "./index";

vi.mock("./edit-memberships", () => ({
  EditMemberships: vi.fn(),
}));

describe("EditMemberships Re-export", () => {
  test("should re-export EditMemberships", () => {
    expect(ExportedEditMemberships).toBe(EditMemberships);
  });
});
