import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_MUTATIONS_FENCED_ERROR_CODE, isAuthzedMutationsFencedError } from "@formbricks/types/errors";
import {
  hasDatabaseOperationalError,
  withDatabaseOperationalErrorContext,
} from "./operational-error-context";

type TAllOperationsHook = (input: {
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

type TCapturedExtension = Readonly<{
  name: string;
  query: Readonly<{ $allOperations: TAllOperationsHook }>;
}>;

const extensionState = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock("./client-options", () => ({ PRISMA_GLOBAL_OMIT: {} }));
vi.mock("./prisma-adapter", () => ({ createPrismaPgAdapter: () => ({ adapter: {} }) }));
vi.mock("./prisma", () => ({
  PrismaClient: class {
    $extends(extension: unknown) {
      extensionState.current = extension;
      return this;
    }
  },
}));

const getCapturedExtension = (): TCapturedExtension => extensionState.current as TCapturedExtension;

beforeEach(async () => {
  extensionState.current = undefined;
  Reflect.deleteProperty(globalThis, "prisma");
  vi.resetModules();
  await import("./client");
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "prisma");
});

describe("Prisma operational error extension", () => {
  test("registers one all-operations interceptor", () => {
    expect(getCapturedExtension().name).toBe("authzed-mutation-fence");
    expect(getCapturedExtension().query.$allOperations).toBeTypeOf("function");
  });

  test("marks the request context and rethrows a cause-free typed fence error", async () => {
    await withDatabaseOperationalErrorContext(async () => {
      const rawError = Object.assign(new Error("raw database failure"), {
        code: "P2010",
        meta: {
          driverAdapterError: {
            cause: {
              originalCode: "P0001",
              originalMessage: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
            },
          },
        },
      });

      const caught = await getCapturedExtension()
        .query.$allOperations({
          args: { data: "not-sensitive" },
          query: () => Promise.reject(rawError),
        })
        .then(
          () => null,
          (error: unknown) => error
        );

      expect(isAuthzedMutationsFencedError(caught)).toBe(true);
      expect(caught).toMatchObject({
        code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
        name: "AuthzedMutationsFencedError",
      });
      expect(Object.prototype.hasOwnProperty.call(caught, "cause")).toBe(false);

      expect(hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)).toBe(true);
    });
  });

  test("returns successful query results unchanged", async () => {
    const result = { id: "result" };

    await expect(
      getCapturedExtension().query.$allOperations({ args: {}, query: () => Promise.resolve(result) })
    ).resolves.toBe(result);
  });

  test("rethrows unrelated failures by identity without marking the request", async () => {
    const failure = new Error("connection unavailable");

    await withDatabaseOperationalErrorContext(async () => {
      await expect(
        getCapturedExtension().query.$allOperations({ args: {}, query: () => Promise.reject(failure) })
      ).rejects.toBe(failure);
      expect(hasDatabaseOperationalError(AUTHZED_MUTATIONS_FENCED_ERROR_CODE)).toBe(false);
    });
  });
});
