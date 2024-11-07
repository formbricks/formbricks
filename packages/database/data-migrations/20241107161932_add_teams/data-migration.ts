/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

interface TInvite {
  organizationId: string;
  deprecatedRole: "owner" | "admin" | "editor" | "developer" | "viewer";
  email: string;
  id: string;
  creatorId: string;
  createdAt: Date;
  expiresAt: Date;
  name?: string | null | undefined;
  acceptorId?: string;
}

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (transactionPrisma) => {
      // Fetch all invites and group them by organizationId
      const invites = (await transactionPrisma.invite.findMany({
        select: {
          id: true,
          organizationId: true,
          deprecatedRole: true,
        },
      })) as Pick<TInvite, "id" | "deprecatedRole" | "organizationId">[];

      // Group invites by organizationId
      const groupInvitesMap = new Map<
        string,
        { id: string; organizationId: string; deprecatedRole: TInvite["deprecatedRole"] }[]
      >();
      invites.forEach((invite) => {
        if (!groupInvitesMap.has(invite.organizationId)) {
          groupInvitesMap.set(invite.organizationId, []);
        }

        groupInvitesMap.get(invite.organizationId)?.push(invite);
      });

      const groupInvites = groupInvitesMap.entries();

      // Process each organization's invites to update roles accordingly
      await Promise.all(
        Array.from(groupInvites).map(async ([organizationId, organizationInvites]) => {
          const adminInvites = organizationInvites.filter((invite) => invite.deprecatedRole === "admin");
          const otherRoles = organizationInvites.filter((invite) => invite.deprecatedRole !== "admin");

          // If no admin invites exist, skip this organization
          if (adminInvites.length === 0) {
            return;
          }

          // Update admin invites to "manager" if there are non-admin roles
          if (otherRoles.length > 0) {
            return transactionPrisma.invite.updateMany({
              where: {
                id: {
                  in: adminInvites.map((invite) => invite.id),
                },
              },
              data: {
                role: "manager",
              },
            });
          }

          // Check if there are other memberships (editor, developer, viewer)
          const otherMembershipsCount = await transactionPrisma.membership.count({
            where: {
              organizationId,
              deprecatedRole: {
                in: ["editor", "developer", "viewer"],
              },
            },
          });

          // If there are other memberships, update admin invites to "manager"
          if (otherMembershipsCount > 0) {
            return transactionPrisma.invite.updateMany({
              where: {
                id: {
                  in: adminInvites.map((invite) => invite.id),
                },
              },
              data: {
                role: "manager",
              },
            });
          }

          // If no other memberships exist, promote admins to "owner", case where the organization has only owner and admin memberships as well as invite
          return transactionPrisma.invite.updateMany({
            where: {
              id: {
                in: adminInvites.map((invite) => invite.id),
              },
            },
            data: {
              role: "owner",
            },
          });
        })
      );

      // Set all invites with roles of editor, developer, or viewer to "member"
      await transactionPrisma.invite.updateMany({
        where: {
          deprecatedRole: {
            in: ["editor", "developer", "viewer"],
          },
        },
        data: {
          role: "member",
        },
      });

      // Fetch non-owner memberships and group them by organizationId
      const nonOwnerMemberships = await transactionPrisma.membership.findMany({
        where: {
          role: {
            notIn: ["owner"],
          },
        },
        select: {
          userId: true,
          organizationId: true,
          deprecatedRole: true,
          organization: {
            select: {
              invites: {
                where: {
                  deprecatedRole: {
                    not: "admin",
                  },
                },
                select: {
                  deprecatedRole: true,
                },
              },
            },
          },
        },
      });

      const groupedMemberships = new Map<string, typeof nonOwnerMemberships>();
      const otherInvitesCount = new Map<string, number>();

      nonOwnerMemberships.forEach((membership) => {
        if (!groupedMemberships.has(membership.organizationId)) {
          groupedMemberships.set(membership.organizationId, []);
        }

        if (!otherInvitesCount.has(membership.organizationId)) {
          otherInvitesCount.set(membership.organizationId, membership.organization.invites.length);
        }

        groupedMemberships.get(membership.organizationId)?.push(membership);
      });

      const groupedMembershipsEntries = groupedMemberships.entries();

      // Process each organization's memberships to update or create teams
      await Promise.all(
        Array.from(groupedMembershipsEntries).map(async ([organizationId, memberships]) => {
          const adminMembership = memberships.filter((membership) => membership.deprecatedRole === "admin");
          const developerMembership = memberships.filter(
            (membership) => membership.deprecatedRole === "developer"
          );
          const editorMembership = memberships.filter((membership) => membership.deprecatedRole === "editor");
          const viewerMembership = memberships.filter((membership) => membership.deprecatedRole === "viewer");

          const otherMemberships =
            developerMembership.length + editorMembership.length + viewerMembership.length;

          // If admin members exist alongside others, set their role to "manager"
          if (adminMembership.length) {
            const otherInvites = otherInvitesCount.get(organizationId) ?? 0;

            await transactionPrisma.membership.updateMany({
              where: {
                organizationId,
                deprecatedRole: "admin",
              },
              data: {
                role: otherMemberships || otherInvites > 0 ? "manager" : "owner",
              },
            });
          }

          // Create team and update roles for developer or editor memberships
          if (developerMembership.length || editorMembership.length || viewerMembership.length) {
            const productIdsInOrganization = await transactionPrisma.product.findMany({
              where: {
                organizationId,
              },
              select: {
                id: true,
              },
            });

            // Create an "all access" team for developer and editor roles
            if (developerMembership.length || editorMembership.length) {
              await transactionPrisma.team.create({
                data: {
                  organizationId,
                  name: "all access",
                  teamUsers: {
                    create: [...developerMembership, ...editorMembership].map((membership) => ({
                      userId: membership.userId,
                      role: "admin",
                    })),
                  },
                  productTeams: {
                    create: productIdsInOrganization.map((product) => ({
                      productId: product.id,
                      permission: "manage",
                    })),
                  },
                },
              });

              await transactionPrisma.membership.updateMany({
                where: {
                  organizationId,
                  deprecatedRole: {
                    in: ["developer", "editor"],
                  },
                },
                data: {
                  role: "member",
                },
              });
            }

            // Create a "read only" team for viewer roles
            if (viewerMembership.length) {
              await transactionPrisma.team.create({
                data: {
                  organizationId,
                  name: "read only",
                  teamUsers: {
                    create: viewerMembership.map((membership) => ({
                      userId: membership.userId,
                      role: "contributor",
                    })),
                  },
                  productTeams: {
                    create: productIdsInOrganization.map((product) => ({
                      productId: product.id,
                      permission: "read",
                    })),
                  },
                },
              });

              await transactionPrisma.membership.updateMany({
                where: {
                  organizationId,
                  deprecatedRole: "viewer",
                },
                data: {
                  role: "member",
                },
              });
            }
          }
        })
      );

      await transactionPrisma.membership.updateMany({
        where: {
          role: "owner",
        },
        data: {
          role: "owner",
        },
      });

      // Clear out the old "role" field in invites after migration
      await transactionPrisma.invite.updateMany({
        data: {
          deprecatedRole: null,
        },
      });

      await transactionPrisma.membership.updateMany({
        data: {
          deprecatedRole: null,
        },
      });
    },
    {
      timeout: TRANSACTION_TIMEOUT,
    }
  );

  const endTime = Date.now();
  console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
}

function handleError(error: unknown): void {
  console.error("An error occurred during migration:", error);
  process.exit(1);
}

function handleDisconnectError(): void {
  console.error("Failed to disconnect Prisma client");
  process.exit(1);
}

function main(): void {
  runMigration()
    .catch(handleError)
    .finally(() => {
      prisma.$disconnect().catch(handleDisconnectError);
    });
}

main();
