import { afterEach, describe, expect, test, vi } from "vitest";

// Pins the runner's wiring to the Prisma CLI TLS translation (ENG-7337): every `migrate deploy` goes
// through runPrismaCli with the migration URL, and a TLS setting the CLI cannot honour stops the run
// before any migration does. The translation itself is tested in ../prisma-cli-tls.test.ts.
const { queryRaw, executeRaw, runPrismaCli, assertPrismaCliTlsSupported } = vi.hoisted(() => {
  // The runner reads its database URL when the module loads; MIGRATE_DATABASE_URL wins over DATABASE_URL.
  process.env.DATABASE_URL = "postgresql://app@runtime-db/formbricks";
  process.env.MIGRATE_DATABASE_URL = "postgresql://migrator@migration-db/formbricks?sslmode=verify-full";
  return {
    queryRaw: vi.fn(),
    executeRaw: vi.fn(),
    runPrismaCli: vi.fn(),
    assertPrismaCliTlsSupported: vi.fn(),
  };
});

vi.mock("../prisma-cli-tls", () => ({ runPrismaCli, assertPrismaCliTlsSupported }));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../prisma-adapter", () => ({ createPrismaPgAdapter: () => ({ adapter: {} }) }));
vi.mock("./online-indexes", () => ({ ensureOnlineIndexes: vi.fn() }));
vi.mock("../prisma", () => ({
  Prisma: { sql: () => ({}), join: () => ({}) },
  PrismaClient: class {
    $queryRaw = queryRaw;
    $executeRaw = executeRaw;
    $disconnect = vi.fn();
  },
}));
// Keep the runner's scratch directory untouched: only the staging calls are stubbed, reads stay real.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const isStaging = (target: unknown) => String(target).includes(".prisma-migrations");
  return {
    default: {
      ...actual,
      mkdir: vi.fn(),
      rm: vi.fn(),
      cp: vi.fn(),
      readdir: (target: string, options?: object) =>
        isStaging(target) ? Promise.resolve([]) : actual.readdir(target, options as never),
    },
  };
});

const { applyMigrations } = await import("./migration-runner");

afterEach(() => {
  vi.clearAllMocks();
});

describe("migration runner TLS wiring", () => {
  test("applies schema migrations through runPrismaCli with the migration database URL", async () => {
    // A fresh database: nothing applied, no data migration recorded, so one deploy applies the schema. This loads
    // the real migration/ folder, and the fresh path needs at least one data migration in it (there are dozens).
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);
    executeRaw.mockResolvedValue(0);

    await applyMigrations();

    expect(assertPrismaCliTlsSupported).toHaveBeenCalledWith(process.env.MIGRATE_DATABASE_URL);
    expect(runPrismaCli).toHaveBeenCalledTimes(1);
    const [, args, options] = runPrismaCli.mock.calls[0] as [string, string[], { databaseUrl: string }];
    expect(args.slice(0, 2)).toEqual(["migrate", "deploy"]);
    expect(options.databaseUrl).toBe(process.env.MIGRATE_DATABASE_URL);
  });

  test("stops before any migration when the CLI cannot honour the TLS settings", async () => {
    assertPrismaCliTlsSupported.mockImplementationOnce(() => {
      throw new Error("Unsupported sslmode");
    });

    await expect(applyMigrations()).rejects.toThrow("Unsupported sslmode");

    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(runPrismaCli).not.toHaveBeenCalled();
  });
});
