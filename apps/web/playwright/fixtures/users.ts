import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Page } from "playwright";
import { TestInfo } from "playwright/test";
import { prisma } from "@formbricks/database";

export const login = async (user: Prisma.UserGetPayload<{ include: { memberships: true } }>, page: Page) => {
  const csrfToken = await page
    .context()
    .request.get("/api/auth/csrf")
    .then((response) => response.json())
    .then((json) => json.csrfToken);
  const data = {
    email: user.email,
    password: user.name,
    callbackURL: "/",
    redirect: "true",
    json: "true",
    csrfToken,
  };

  await page.context().request.post("/api/auth/callback/credentials", {
    data,
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
    }) => {
      const uname = params?.name ?? `user-${workerInfo.workerIndex}-${Date.now()}`;
      const userEmail = params?.email ?? `${uname}@example.com`;
      const hashedPassword = await bcrypt.hash(uname, 10);

      const user = await prisma.user.create({
        data: {
          name: uname,
          email: userEmail,
          password: hashedPassword,
          emailVerified: new Date(),
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
