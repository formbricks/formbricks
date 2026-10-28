import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { type TMemberRow, buildMemberRows } from "./member-rows";

/** Seats are few; this only keeps a pathological organization from loading unbounded. */
export const MEMBER_DIRECTORY_LIMIT = 500;

export interface TMemberDirectory {
  rows: TMemberRow[];
  /** More members or invites exist than the page shows. */
  isTruncated: boolean;
}

/**
 * Members and pending invites of an organization for the members table (teams only supply names): three queries, whatever
 * the size. Team names and two-factor state ride along on the member query, so no row costs another one.
 *
 * Two-factor state and team memberships are security-relevant, so they are selected only when
 * `includeSensitive` is true (owner or manager) rather than loaded and hidden in the UI.
 */
export const getMemberDirectory = reactCache(
  async (organizationId: string, includeSensitive: boolean): Promise<TMemberDirectory> => {
    validateInputs([organizationId, ZId]);

    try {
      const [memberships, invites, teams] = await Promise.all([
        // Two literal selects rather than a conditional spread: Prisma only infers the result type of a
        // select it can see in full.
        includeSensitive
          ? prisma.membership.findMany({
              where: { organizationId },
              select: {
                userId: true,
                role: true,
                user: {
                  select: {
                    name: true,
                    email: true,
                    isActive: true,
                    twoFactorEnabled: true,
                    teamUsers: {
                      where: { team: { organizationId } },
                      select: { team: { select: { name: true } } },
                    },
                  },
                },
              },
              orderBy: { userId: "asc" },
              take: MEMBER_DIRECTORY_LIMIT + 1,
            })
          : prisma.membership.findMany({
              where: { organizationId },
              select: {
                userId: true,
                role: true,
                user: { select: { name: true, email: true, isActive: true } },
              },
              orderBy: { userId: "asc" },
              take: MEMBER_DIRECTORY_LIMIT + 1,
            }),
        prisma.invite.findMany({
          where: { organizationId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            expiresAt: true,
            teamIds: includeSensitive,
          },
          orderBy: { createdAt: "desc" },
          take: MEMBER_DIRECTORY_LIMIT + 1,
        }),
        prisma.team.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: MEMBER_DIRECTORY_LIMIT,
        }),
      ]);

      const isTruncated =
        memberships.length > MEMBER_DIRECTORY_LIMIT || invites.length > MEMBER_DIRECTORY_LIMIT;

      return {
        rows: buildMemberRows({
          memberships: memberships.slice(0, MEMBER_DIRECTORY_LIMIT),
          invites: invites.slice(0, MEMBER_DIRECTORY_LIMIT),
          teamNameById: new Map(teams.map((team) => [team.id, team.name])),
          now: new Date(),
        }),
        isTruncated,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
