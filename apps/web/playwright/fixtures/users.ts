import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Page } from "playwright";
import { expect } from "playwright/test";
import { prisma } from "@formbricks/database";

export const login = async (user: Prisma.UserGetPayload<{ include: { memberships: true } }>, page: Page) => {
  console.log("logging in", user);
  await page.goto("/auth/login");

  await expect(page.getByRole("button", { name: "Login with Email" })).toBeVisible();

  await page.getByRole("button", { name: "Login with Email" }).click();

  await expect(page.getByPlaceholder("work@email.com")).toBeVisible();

  await page.getByPlaceholder("work@email.com").fill(user.email);

  await expect(page.getByPlaceholder("*******")).toBeVisible();

  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(user.name);
  await page.getByRole("button", { name: "Login with Email" }).click();
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

export const createUsersFixture = (page: Page) => {
  return {
    create: async (params: {
      name: string;
      email: string;
      organizationName: string;
      productName?: string;
    }) => {
      const hashedPassword = await bcrypt.hash(params.name, 10);

      const user = await prisma.user.create({
        data: {
          name: params.name,
          email: params.email,
          password: hashedPassword,
          memberships: {
            create: {
              organization: {
                create: {
                  name: params.organizationName,
                  billing: {
                    plan: "free",
                    limits: { monthly: { responses: 500, miu: 1000 } },
                    stripeCustomerId: null,
                    periodStart: new Date(),
                    period: "monthly",
                  },
                  products: {
                    create: {
                      name: params.productName ?? "My Product",
                      environments: {
                        create: [{ type: "development" }, { type: "production" }],
                      },
                    },
                  },
                },
              },
              role: "owner",
            },
          },
        },
        include: { memberships: true },
      });

      console.log("created user", user);

      const userFixture = createUserFixture(user, page);
      return userFixture;
    },
  };
};
