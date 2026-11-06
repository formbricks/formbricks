import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";
import {
  MAX_EMBEDDED_DATA_DEFINITIONS,
  getNumericEmbeddedFields,
  resolveNumericEmbeddedFields,
} from "./embedded-field-types";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { embeddedData: { findMany: vi.fn() } } }));
// vitestSetup.ts fakes `crypto` for the license checks; a member name is a real hash.
vi.unmock("crypto");
vi.unmock("node:crypto");

const findMany = vi.mocked(prisma.embeddedData.findMany);

describe("resolveNumericEmbeddedFields", () => {
  test("a key is a number when every field published under it is a number field", () => {
    const numeric = resolveNumericEmbeddedFields([
      { name: "seats", dataType: "number" },
      { name: " seats ", dataType: "number" },
      { name: "score", dataType: "number" },
      { name: "plan", dataType: "string" },
    ]);
    expect(numeric).toEqual(new Set([getEmbeddedMemberName("seats"), getEmbeddedMemberName("score")]));
  });

  test("a key two fields of different types publish, or no number field, stays text", () => {
    const numeric = resolveNumericEmbeddedFields([
      { name: "seats", dataType: "number" },
      { name: "seats", dataType: "string" },
      { name: "joined", dataType: "date" },
      { name: "  ", dataType: "number" },
    ]);
    expect(numeric).toEqual(new Set());
  });

  test("reads a key as a response publishes it: trimmed, without NUL bytes", () => {
    expect(resolveNumericEmbeddedFields([{ name: "se\u0000ats ", dataType: "number" }])).toEqual(
      new Set([getEmbeddedMemberName("seats")])
    );
  });
});

describe("getNumericEmbeddedFields", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  test("reads the workspace's fields linked to surveys mapped into the datasets, in one query", async () => {
    findMany.mockResolvedValue([{ name: "seats", dataType: "number" }] as never);

    await expect(getNumericEmbeddedFields("ws_1", ["ds_a", "ds_b"])).resolves.toEqual(
      new Set([getEmbeddedMemberName("seats")])
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws_1",
        surveyLinks: {
          some: {
            workspaceId: "ws_1",
            survey: {
              feedbackSourceMappings: {
                some: {
                  workspaceId: "ws_1",
                  feedbackSource: { workspaceId: "ws_1", feedbackDirectoryId: { in: ["ds_a", "ds_b"] } },
                },
              },
            },
          },
        },
      },
      select: { name: true, dataType: true },
      take: MAX_EMBEDDED_DATA_DEFINITIONS + 1,
    });
  });

  test("reads nothing for a dashboard without datasets", async () => {
    await expect(getNumericEmbeddedFields("ws_1", [])).resolves.toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  test("past the cap, every key stays text", async () => {
    findMany.mockResolvedValue(
      Array.from({ length: MAX_EMBEDDED_DATA_DEFINITIONS + 1 }, () => ({
        name: "seats",
        dataType: "number",
      })) as never
    );
    await expect(getNumericEmbeddedFields("ws_1", ["ds_a"])).resolves.toEqual(new Set());
  });
});
