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
  page: Page
) => {
  return {
    login: async () => {
      await login(user, page);
    },
  };
};

export type UserFixture = ReturnType<typeof createUserFixture>;

export const createUsersFixture = (page: Page, workerInfo: TestInfo) => {
  const store: { users: UserFixture[] } = {
    users: [],
  };

  return {
    create: async (params?: {
      name?: string;
      email?: string;
      organizationName?: string;
      projectName?: string;
      withoutProject?: boolean;
    }) => {
      const uname = params?.name ?? `user-${workerInfo.workerIndex}-${Date.now()}`;
      const userEmail = params?.email ?? `${uname}@example.com`;
      const hashedPassword = await bcrypt.hash(uname, 10);

      const user = await prisma.user.create({
        data: {
          name: uname,
          email: userEmail,
          password: hashedPassword,
          locale: "en-US",
          memberships: {
            create: {
              organization: {
                create: {
                  name: params?.organizationName ?? "My Organization",
                  billing: {
                    plan: "free",
                    limits: { projects: 3, monthly: { responses: 1500, miu: 2000 } },
                    stripeCustomerId: null,
                    periodStart: new Date(),
                    period: "monthly",
                  },
                  ...(!params?.withoutProject && {
                    projects: {
                      create: {
                        name: params?.projectName ?? "My Project",
                        environments: {
                          create: [
                            {
                              type: "development",
                              attributeKeys: {
                                create: [
                                  {
                                    name: "userId",
                                    key: "userId",
                                    isUnique: true,
                                    type: "default",
                                  },
                                ],
                              },
                            },
                            {
                              type: "production",
                              attributeKeys: {
                                create: [
                                  {
                                    name: "userId",
                                    key: "userId",
                                    isUnique: true,
                                    type: "default",
                                  },
                                ],
                              },
                            },
                          ],
                        },
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

      const userFixture = createUserFixture(user, page);

      store.users.push(userFixture);

      return userFixture;
    },
    get: () => store.users,
  };
};
