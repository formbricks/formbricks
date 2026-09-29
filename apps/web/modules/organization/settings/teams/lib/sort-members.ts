import { TMember } from "@formbricks/types/memberships";

export type TLastSignInSort = "desc" | "asc";

/**
 * Orders members by last sign-in for the Members table. A `null` sign-in is treated as the oldest possible
 * one — it means no sign-in since the column shipped — so it leads an oldest-first sort, where an admin
 * hunting for dormant accounts is looking, and trails a newest-first one. Ties keep their original order.
 */
export const sortMembersByLastSignIn = (members: TMember[], direction: TLastSignInSort): TMember[] => {
  const time = (member: TMember) => member.lastLoginAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  // Two `null`s subtract to NaN (−∞ − −∞); `|| 0` turns that into a tie instead of an unstable order.
  return [...members].sort((a, b) => (direction === "asc" ? time(a) - time(b) : time(b) - time(a)) || 0);
};
