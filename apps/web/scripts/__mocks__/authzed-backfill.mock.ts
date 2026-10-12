import { vi } from "vitest";

const { runBackfill, disconnect } = vi.hoisted(() => ({
  runBackfill: vi.fn(),
  disconnect: vi.fn(),
}));

export { runBackfill, disconnect };

vi.mock("../../lib/authzed/backfill-cli", () => ({ runAuthzedBackfillCli: runBackfill }));
vi.mock("@formbricks/database", () => ({ prisma: { $disconnect: disconnect } }));
