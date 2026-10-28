import type { DocumentReview, PushArguments } from "../review";

export const documentId = "kj4a98xxat96iws9zmbrgj3a";
export const updatedAt = "2026-10-28T12:00:00.000Z";

export const makeReview = (overrides: Partial<DocumentReview> = {}): DocumentReview => ({
  kind: "survey",
  id: documentId,
  name: "Onboarding",
  workspaceId: "ws1",
  schemaVersion: 1,
  status: "valid",
  updatedAt,
  expectedUpdatedAt: updatedAt,
  summary: { total: 2, added: 0, removed: 1, changed: 1, destructive: 0 },
  changes: [
    { path: "name", kind: "changed", before: "A", after: "B" },
    { path: "blocks[b2]", kind: "removed", before: { id: "b2" } },
  ],
  omittedChanges: 0,
  destructive: [],
  issues: [],
  ...overrides,
});

export const toolInput = {
  kind: "survey",
  id: documentId,
  schemaVersion: 1,
  expectedUpdatedAt: updatedAt,
  document: { name: "B" },
} satisfies PushArguments;
