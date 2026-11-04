import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SurveyWriteAfterCommitError, runInSurveyWriteTransaction } from "./write-transaction";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  // The write runs as a committed transaction would: once, with a client of its own.
  vi.mocked(prisma.$transaction).mockImplementation(async (write) => write(prisma));
});

describe("runInSurveyWriteTransaction", () => {
  test("runs every after-commit effect, in order, once the write has committed", async () => {
    const ran: string[] = [];

    const result = await runInSurveyWriteTransaction(async ({ afterCommit }) => {
      afterCommit(async () => ran.push("first"));
      afterCommit(async () => ran.push("second"));
      return "written";
    });

    expect(result).toBe("written");
    expect(ran).toEqual(["first", "second"]);
  });

  test("still runs the effects after one that fails, and reports every failure with the write's result", async () => {
    const ran: string[] = [];
    const scheduling = new Error("scheduling failed");
    const cache = new Error("cache invalidation failed");

    const error = await runInSurveyWriteTransaction(async ({ afterCommit }) => {
      afterCommit(async () => {
        throw scheduling;
      });
      afterCommit(async () => ran.push("subscription"));
      afterCommit(async () => {
        throw cache;
      });
      return "written";
    }).catch((thrown: unknown) => thrown);

    expect(ran).toEqual(["subscription"]);
    expect(error).toBeInstanceOf(SurveyWriteAfterCommitError);
    expect((error as SurveyWriteAfterCommitError).result).toBe("written");
    expect((error as SurveyWriteAfterCommitError).cause).toEqual(
      new AggregateError([scheduling, cache], "2 after-commit effects failed")
    );
  });
});
