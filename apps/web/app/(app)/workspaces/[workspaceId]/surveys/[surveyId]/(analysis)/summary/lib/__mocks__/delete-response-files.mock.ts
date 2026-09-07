import { vi } from "vitest";

/**
 * Storage boundary for the survey-reset tests. Kept in `__mocks__` (per AGENTS.md) so the `vi.mock`
 * call is hoisted by the import order rather than by a bare `vi.mock` inside each spec.
 */
export const deleteResponseFileUrls = vi.fn<(fileUrls: string[], workspaceId?: string) => Promise<void>>();

vi.mock("@/modules/storage/lib/delete-response-files", () => ({
  deleteResponseFileUrls,
}));
