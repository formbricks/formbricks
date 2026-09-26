import { describe, expect, test } from "vitest";
import { TMember } from "@formbricks/types/memberships";
import { sortMembersByLastSignIn } from "./sort-members";

const member = (userId: string, lastLoginAt: Date | null): TMember => ({
  name: userId,
  email: `${userId}@example.com`,
  userId,
  accepted: true,
  role: "member",
  isActive: true,
  lastLoginAt,
});

const members = [
  member("recent", new Date("2026-09-20")),
  member("never", null),
  member("old", new Date("2026-01-10")),
  member("middle", new Date("2026-06-01")),
];

const ids = (list: TMember[]) => list.map((m) => m.userId);

describe("sortMembersByLastSignIn", () => {
  test("newest first puts members with no recorded sign-in last", () => {
    expect(ids(sortMembersByLastSignIn(members, "desc"))).toEqual(["recent", "middle", "old", "never"]);
  });

  test("oldest first puts members with no recorded sign-in first", () => {
    expect(ids(sortMembersByLastSignIn(members, "asc"))).toEqual(["never", "old", "middle", "recent"]);
  });

  test("keeps the original order among members without a sign-in", () => {
    const list = [member("a", null), member("b", null), member("c", new Date("2026-01-01"))];
    expect(ids(sortMembersByLastSignIn(list, "asc"))).toEqual(["a", "b", "c"]);
  });

  test("does not mutate the input", () => {
    const copy = [...members];
    sortMembersByLastSignIn(members, "asc");
    expect(members).toEqual(copy);
  });
});
