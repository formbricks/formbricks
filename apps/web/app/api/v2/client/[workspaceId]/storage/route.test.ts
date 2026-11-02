import { describe, expect, test, vi } from "vitest";
import { OPTIONS as v1Options, POST as v1Post } from "@/app/api/v1/client/[workspaceId]/storage/route";
import { OPTIONS, POST } from "./route";

vi.mock("@/app/api/v1/client/[workspaceId]/storage/route", () => ({ OPTIONS: vi.fn(), POST: vi.fn() }));

describe("v2 client storage route", () => {
  // The PIN and single-use gates live in the v1 handler; v2 must stay a pure re-export so it can
  // never drift into an ungated copy.
  test("re-exports the v1 handlers", () => {
    expect(POST).toBe(v1Post);
    expect(OPTIONS).toBe(v1Options);
  });
});
