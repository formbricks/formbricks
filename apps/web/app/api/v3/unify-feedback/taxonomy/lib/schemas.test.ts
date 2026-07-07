import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import {
  ZNodeIdParams,
  ZNodeRecordsQuery,
  ZRenameNodeBody,
  ZRunIdParams,
  ZTaxonomyStateQuery,
  ZTriggerRunBody,
  ZWorkspaceDirectoryQuery,
} from "./schemas";

const workspaceId = createId();
const directoryId = createId();
const uuid = "123e4567-e89b-12d3-a456-426614174000";

describe("ZWorkspaceDirectoryQuery", () => {
  test("accepts cuid2 workspace + directory ids", () => {
    expect(ZWorkspaceDirectoryQuery.parse({ workspaceId, directoryId })).toEqual({
      workspaceId,
      directoryId,
    });
  });

  test("rejects a non-cuid2 id and unknown keys", () => {
    expect(ZWorkspaceDirectoryQuery.safeParse({ workspaceId: "not a cuid", directoryId }).success).toBe(
      false
    );
    expect(ZWorkspaceDirectoryQuery.safeParse({ workspaceId, directoryId, extra: "x" }).success).toBe(false);
  });
});

describe("ZTaxonomyStateQuery", () => {
  test("accepts the empty sourceId 'no source' bucket", () => {
    expect(
      ZTaxonomyStateQuery.parse({
        workspaceId,
        directoryId,
        sourceType: "survey",
        sourceId: "",
        fieldId: "q1",
      }).sourceId
    ).toBe("");
  });

  test("still requires a non-empty sourceType and fieldId", () => {
    expect(
      ZTaxonomyStateQuery.safeParse({
        workspaceId,
        directoryId,
        sourceType: "",
        sourceId: "",
        fieldId: "q1",
      }).success
    ).toBe(false);
  });
});

describe("ZNodeRecordsQuery", () => {
  test("coerces limit and defaults it to 100", () => {
    expect(ZNodeRecordsQuery.parse({ workspaceId, directoryId }).limit).toBe(100);
    expect(ZNodeRecordsQuery.parse({ workspaceId, directoryId, limit: "25" }).limit).toBe(25);
  });

  test("rejects an out-of-range limit", () => {
    expect(ZNodeRecordsQuery.safeParse({ workspaceId, directoryId, limit: 500 }).success).toBe(false);
  });
});

describe("ZTriggerRunBody", () => {
  test("accepts an optional fieldLabel", () => {
    expect(
      ZTriggerRunBody.parse({
        workspaceId,
        directoryId,
        sourceType: "survey",
        sourceId: "",
        fieldId: "q1",
        fieldLabel: "Question 1",
      }).fieldLabel
    ).toBe("Question 1");
  });
});

describe("ZRenameNodeBody", () => {
  test("requires a non-empty label", () => {
    expect(ZRenameNodeBody.parse({ workspaceId, directoryId, label: "Pricing" }).label).toBe("Pricing");
    expect(ZRenameNodeBody.safeParse({ workspaceId, directoryId, label: "" }).success).toBe(false);
  });
});

describe("ZRunIdParams / ZNodeIdParams", () => {
  test("accept a uuid and reject anything else", () => {
    expect(ZRunIdParams.parse({ runId: uuid }).runId).toBe(uuid);
    expect(ZNodeIdParams.parse({ nodeId: uuid }).nodeId).toBe(uuid);
    expect(ZRunIdParams.safeParse({ runId: "nope" }).success).toBe(false);
    expect(ZNodeIdParams.safeParse({ nodeId: "nope" }).success).toBe(false);
  });
});
