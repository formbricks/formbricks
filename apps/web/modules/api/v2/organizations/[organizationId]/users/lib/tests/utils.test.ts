import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { describe, expect, test, vi } from "vitest";
import { getUsersQuery } from "../utils";

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

describe("getUsersQuery", () => {
  test("returns default query if no params are provided", () => {
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

  test("includes email filter if email param is provided", () => {
    const result = getUsersQuery("org123", { email: "test@example.com" } as TGetUsersFilter);
    expect(result.where?.email).toEqual({
      contains: "test@example.com",
      mode: "insensitive",
    });
  });

  test("includes id filter if id param is provided", () => {
    const result = getUsersQuery("org123", { id: "user123" } as TGetUsersFilter);
    expect(result.where?.id).toBe("user123");
  });

  test("applies baseFilter if pickCommonFilter returns something", () => {
    vi.mocked(pickCommonFilter).mockReturnValueOnce({ someField: "test" } as unknown as ReturnType<
      typeof pickCommonFilter
    >);
    getUsersQuery("org123", {} as TGetUsersFilter);
    expect(buildCommonFilterQuery).toHaveBeenCalled();
  });
});
