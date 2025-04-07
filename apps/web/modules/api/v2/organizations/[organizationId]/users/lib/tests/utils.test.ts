import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { describe, expect, it, vi } from "vitest";
import { getUsersQuery } from "../utils";

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

describe("getUsersQuery", () => {
  it("returns default query if no params are provided", () => {
    const result = getUsersQuery("org123");
    expect(result).toEqual({
      where: {
        memberships: {
          some: {
            organizationId: "org123",
          },
        },
      },
    });
  });

  it("includes email filter if email param is provided", () => {
    const result = getUsersQuery("org123", { email: "test@example.com" } as TGetUsersFilter);
    expect(result.where?.email).toEqual({
      contains: "test@example.com",
      mode: "insensitive",
    });
  });

  it("includes id filter if id param is provided", () => {
    const result = getUsersQuery("org123", { id: "user123" } as TGetUsersFilter);
    expect(result.where?.id).toBe("user123");
  });

  it("applies baseFilter if pickCommonFilter returns something", () => {
    vi.mocked(pickCommonFilter).mockReturnValueOnce({ someField: "test" } as unknown as ReturnType<
      typeof pickCommonFilter
    >);
    getUsersQuery("org123", {} as TGetUsersFilter);
    expect(buildCommonFilterQuery).toHaveBeenCalled();
  });
});
