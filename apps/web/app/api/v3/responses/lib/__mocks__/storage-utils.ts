import { vi } from "vitest";

/**
 * The `validateClientFileUploads` seam, shared by the operation tests that drive a write path.
 *
 * It lives here rather than inline in each test because the `vi.mock` call has to register before the
 * module under test is imported, and the import-sort rule puts `__mocks__` imports first — which is the
 * reason AGENTS.md asks for mocks in this directory.
 *
 * Deliberately not shared with `service.test.ts`: that file stubs different exports of the same module
 * (`collectResponseFileUrls`, `getSurveyFileUploadElementIds`) with behaviour tied to its own fixtures,
 * so folding it in here would couple this file to that test's data rather than remove duplication.
 *
 * Each test sets its own return value in `beforeEach`; nothing is assumed about the default.
 */
export const mockValidateFileUploads = vi.fn();

vi.mock("@/modules/storage/utils", () => ({ validateClientFileUploads: mockValidateFileUploads }));
