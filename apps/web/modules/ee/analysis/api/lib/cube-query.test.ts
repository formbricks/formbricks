import { describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getCubeQueryAuditSummary, validateCubeQueryMembers } from "./cube-query";

vi.mock("server-only", () => ({}));

describe("cube-query", () => {
  describe("validateCubeQueryMembers", () => {
    test("does not throw for valid query members", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.sourceType"],
          timeDimensions: [{ dimension: "FeedbackRecords.collectedAt" }],
          filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] }],
          order: { "FeedbackRecords.collectedAt": "desc" },
        })
      ).not.toThrow();
    });

    test("throws for invalid members across query sections", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["Other.count"],
          dimensions: ["OtherCube.field"],
          order: [["Invalid.order", "asc"]],
        })
      ).toThrow(/Invalid query members.*Invalid\.order.*Other\.count.*OtherCube\.field/);
    });

    test("rejects explicit tenant filters", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count"],
          filters: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
        })
      ).toThrow(/Tenant filters are enforced by Cube/);
    });

    test("rejects deprecated dimension tenant filters", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count"],
          filters: [{ dimension: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
        } as unknown as TChartQuery)
      ).toThrow(/Tenant filters are enforced by Cube/);
    });

    test("rejects nested tenant filters in logical expressions", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count"],
          filters: [
            {
              or: [
                { member: "FeedbackRecords.sourceType", operator: "equals", values: ["positive"] },
                {
                  and: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
                },
              ],
            },
          ],
        })
      ).toThrow(/Tenant filters are enforced by Cube/);
    });

    test("rejects tenant member usage outside filters", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.tenantId"],
        })
      ).toThrow(/Tenant filters are enforced by Cube/);
    });

    test("rejects tenant member usage in order clauses", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count"],
          order: { "FeedbackRecords.tenantId": "asc" },
        })
      ).toThrow(/Tenant filters are enforced by Cube/);
    });

    test("rejects malformed member references without throwing runtime type errors", () => {
      expect(() =>
        validateCubeQueryMembers({
          measures: ["FeedbackRecords.count", null],
          dimensions: [{ member: "FeedbackRecords.sourceType" }],
          segments: [0],
          timeDimensions: [null, { dimension: null }],
          filters: [null, { member: { name: "FeedbackRecords.sourceType" } }, { and: [0] }, { or: "bad" }],
          order: [[null, "asc"], null],
        } as unknown as TChartQuery)
      ).toThrow(/Invalid query members.*invalid member reference/);
    });
  });

  test("summarizes query members without raw filter values", () => {
    const summary = getCubeQueryAuditSummary({
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.sourceType"],
      filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["secret-value"] }],
      order: [["FeedbackRecords.collectedAt", "desc"]],
      limit: 50,
    });

    expect(summary).toEqual({
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.sourceType"],
      segments: [],
      timeDimensions: [],
      filterMembers: ["FeedbackRecords.sourceType"],
      filterCount: 1,
      orderMembers: ["FeedbackRecords.collectedAt"],
      limit: 50,
    });
    expect(JSON.stringify(summary)).not.toContain("secret-value");
  });

  test("summarizes only valid member names from malformed query shapes", () => {
    const summary = getCubeQueryAuditSummary({
      measures: ["FeedbackRecords.count", null],
      dimensions: [{ member: "FeedbackRecords.sourceType" }],
      timeDimensions: [null, { dimension: "FeedbackRecords.collectedAt" }],
      filters: [
        null,
        { member: "FeedbackRecords.sourceType", operator: "equals", values: ["secret-value"] },
        { and: [0, { member: "FeedbackRecords.sourceType", operator: "equals", values: ["positive"] }] },
      ],
      order: [
        [null, "asc"],
        ["FeedbackRecords.collectedAt", "desc"],
      ],
    } as unknown as TChartQuery);

    expect(summary).toEqual({
      measures: ["FeedbackRecords.count"],
      dimensions: [],
      segments: [],
      timeDimensions: ["FeedbackRecords.collectedAt"],
      filterMembers: ["FeedbackRecords.sourceType", "FeedbackRecords.sourceType"],
      filterCount: 2,
      orderMembers: ["FeedbackRecords.collectedAt"],
    });
    expect(JSON.stringify(summary)).not.toContain("secret-value");
  });
});
