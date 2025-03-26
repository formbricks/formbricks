import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getResponsesQuery } from "../utils";

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

describe("getResponsesQuery", () => {
  it("adds surveyId to where clause if provided", () => {
    const result = getResponsesQuery(["env-id"], { surveyId: "survey123" } as TGetResponsesFilter);
    expect(result?.where?.surveyId).toBe("survey123");
  });

  it("adds contactId to where clause if provided", () => {
    const result = getResponsesQuery(["env-id"], { contactId: "contact123" } as TGetResponsesFilter);
    expect(result?.where?.contactId).toBe("contact123");
  });

  it("calls pickCommonFilter & buildCommonFilterQuery with correct arguments", () => {
    vi.mocked(pickCommonFilter).mockReturnValueOnce({ someFilter: true } as any);
    vi.mocked(buildCommonFilterQuery).mockReturnValueOnce({ where: { combined: true } as any });

    const result = getResponsesQuery(["env-id"], { surveyId: "test" } as TGetResponsesFilter);
    expect(pickCommonFilter).toHaveBeenCalledWith({ surveyId: "test" });
    expect(buildCommonFilterQuery).toHaveBeenCalledWith(
      expect.objectContaining<Prisma.ResponseFindManyArgs>({
        where: {
          survey: { environmentId: { in: ["env-id"] } },
          surveyId: "test",
        },
      }),
      { someFilter: true }
    );
    expect(result).toEqual({ where: { combined: true } });
  });
});
