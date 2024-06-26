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
      productName?: string;
      withoutProduct?: boolean;
    }) => {
      const uname = params?.name ?? `user-${workerInfo.workerIndex}-${Date.now()}`;
      const userEmail = params?.email ?? `${uname}@example.com`;
      const hashedPassword = await bcrypt.hash(uname, 10);

      const user = await prisma.user.create({
        data: {
          name: uname,
          email: userEmail,
          password: hashedPassword,
          memberships: {
            create: {
              organization: {
                create: {
                  name: params?.organizationName ?? "My Organization",
                  billing: {
                    plan: "free",
                    limits: { monthly: { responses: 500, miu: 1000 } },
                    stripeCustomerId: null,
                    periodStart: new Date(),
                    period: "monthly",
                  },
                  ...(!params?.withoutProduct && {
                    products: {
                      create: {
                        name: params?.productName ?? "My Product",
                        environments: {
                          create: [
                            {
                              type: "development",
                              actionClasses: {
                                create: [
                                  {
                                    name: "New Session",
                                    description: "Gets fired when a new session is created",
                                    type: "automatic",
                                  },
                                ],
                              },
                            },
                            {
                              type: "production",
                              actionClasses: {
                                create: [
                                  {
                                    name: "New Session",
                                    description: "Gets fired when a new session is created",
                                    type: "automatic",
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
