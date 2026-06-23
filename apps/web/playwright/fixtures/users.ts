import bcrypt from "bcryptjs";
import { Page } from "playwright";
import { TestInfo } from "playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";

export const login = async (user: Prisma.UserGetPayload<{ include: { memberships: true } }>, page: Page) => {
  // Better Auth sign-in (replaces the NextAuth csrf + credentials-callback flow; ENG-1054). The
  // fixture's plaintext password is the user name (createUsersFixture hashes `name` into the bcrypt
  // credential account below). Better Auth sets the signed session cookie on the response, which is
  // shared with the browser through Playwright's request/context cookie jar — so the subsequent
  // page.goto sends it.
  await page.context().request.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.name },
  });

  await page.goto("/");
};

export const createUserFixture = (
  user: Prisma.UserGetPayload<{ include: { memberships: true } }>,
  page: Page,
  ids?: { workspaceId: string }
) => {
  return {
    login: async () => {
      await login(user, page);
    },
    id: user.id,
    organizationId: user.memberships[0]?.organizationId,
    workspaceId: ids?.workspaceId,
  };
};

export type UserFixture = ReturnType<typeof createUserFixture>;

export type UsersFixture = {
  create: (params?: {
    name?: string;
    email?: string;
    organizationName?: string;
    workspaceName?: string;
    withoutWorkspace?: boolean;
    skipSurveySeed?: boolean;
  }) => Promise<UserFixture>;
  get: () => UserFixture[];
};

export const createUsersFixture = (page: Page, workerInfo: TestInfo): UsersFixture => {
  const store: { users: UserFixture[] } = {
    users: [],
  };

  return {
    create: async (params?: {
      name?: string;
      email?: string;
      organizationName?: string;
      workspaceName?: string;
      withoutWorkspace?: boolean;
      skipSurveySeed?: boolean;
    }) => {
      const uname = params?.name ?? `user-${workerInfo.workerIndex}-${Date.now()}`;
      const userEmail = params?.email ?? `${uname}@example.com`;
      const hashedPassword = await bcrypt.hash(uname, 10);

      const user = await prisma.user.create({
        data: {
          name: uname,
          email: userEmail,
          password: hashedPassword,
          emailVerified: true,
          locale: "en-US",
          memberships: {
            create: {
              organization: {
                create: {
                  name: params?.organizationName ?? "My Organization",
                  billing: {
                    create: {
                      limits: { workspaces: 3, monthly: { responses: 1500 } },
                      stripeCustomerId: null,
                      usageCycleAnchor: new Date(),
                    },
                  },
                  ...(!params?.withoutWorkspace && {
                    workspaces: {
                      create: {
                        name: params?.workspaceName ?? "My Workspace",
                      },
                    },
                  }),
                },
              },
              role: "owner",
            },
          },
        },
        include: { memberships: true },
      });

      // Better Auth verifies credential sign-in against the `account` table (provider "credential"),
      // not `user.password` — so a Prisma-seeded user needs an explicit credential account for
      // POST /api/auth/sign-in/email (used by `login` above) to succeed (ENG-1054). The bcrypt hash
      // of `uname` is the same secret `login` sends as the plaintext password.
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "credential",
          provider: "credential",
          providerAccountId: user.id,
          password: hashedPassword,
        },
      });

      // Collect workspace ID for tests
      let ids: { workspaceId: string } | undefined;
      if (!params?.withoutWorkspace) {
        const workspace = await prisma.workspace.findFirst({
          where: { organizationId: user.memberships[0].organizationId },
        });

        if (workspace) {
          const defaultKeys = [
            { name: "Email", key: "email", isUnique: true, type: "default" as const },
            { name: "First Name", key: "firstName", isUnique: false, type: "default" as const },
            { name: "Last Name", key: "lastName", isUnique: false, type: "default" as const },
            { name: "userId", key: "userId", isUnique: true, type: "default" as const },
          ];

          await prisma.contactAttributeKey.createMany({
            data: defaultKeys.map((k) => ({
              ...k,
              workspaceId: workspace.id,
            })),
          });

          if (!params?.skipSurveySeed) {
            await prisma.survey.create({
              data: {
                workspaceId: workspace.id,
                createdBy: user.id,
                name: "E2E Seed Survey",
                status: "draft",
                type: "link",
              },
            });
          }

          ids = { workspaceId: workspace.id };
        }
      }

      const userFixture = createUserFixture(user, page, ids);

      store.users.push(userFixture);

      return userFixture;
    },
    get: () => store.users,
  };
};
