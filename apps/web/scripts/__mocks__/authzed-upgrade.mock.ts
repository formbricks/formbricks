import { vi } from "vitest";

const { runUpgrade, disconnect } = vi.hoisted(() => ({
  runUpgrade: vi.fn(),
  disconnect: vi.fn(),
}));

export { runUpgrade, disconnect };

vi.mock("../../lib/authzed/upgrade-cli", () => ({ runAuthzedUpgradeCli: runUpgrade }));
vi.mock("@formbricks/database", () => ({ prisma: { $disconnect: disconnect } }));
