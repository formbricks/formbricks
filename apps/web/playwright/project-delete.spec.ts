import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

const createEnvironmentData = (type: "development" | "production") => ({
  type,
  attributeKeys: {
    create: [
      {
        name: "Email",
        key: "email",
        isUnique: true,
        type: "default" as const,
      },
      {
        name: "First Name",
        key: "firstName",
        isUnique: false,
        type: "default" as const,
      },
      {
        name: "Last Name",
        key: "lastName",
        isUnique: false,
        type: "default" as const,
      },
      {
        name: "userId",
        key: "userId",
        isUnique: true,
        type: "default" as const,
      },
    ],
  },
});

const getProjectForEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      memberships: {
        select: {
          organizationId: true,
          organization: {
            select: {
              projects: {
                select: {
                  id: true,
                  name: true,
                  environments: {
                    select: {
                      id: true,
                      type: true,
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  const membership = user?.memberships[0];
  const project = membership?.organization.projects[0];
  const productionEnvironment = project?.environments.find(
    (environment) => environment.type === "production"
  );

  if (!membership || !project || !productionEnvironment) {
    throw new Error(`Project not found for email: ${email}`);
  }

  return {
    organizationId: membership.organizationId,
    projectId: project.id,
    projectName: project.name,
    productionEnvironmentId: productionEnvironment.id,
  };
};

test("requires project name confirmation before deleting a project", async ({ page, users }) => {
  const timestamp = Date.now();
  const email = `project-delete-${timestamp}@example.com`;
  const projectName = `Delete Project ${timestamp}`;
  const remainingProjectName = `Remaining Project ${timestamp}`;
  const user = await users.create({
    email,
    name: `project-delete-${timestamp}`,
    projectName,
  });
  const project = await getProjectForEmail(email);
  const remainingProject = await prisma.project.create({
    data: {
      name: remainingProjectName,
      organizationId: project.organizationId,
      environments: {
        create: [createEnvironmentData("development"), createEnvironmentData("production")],
      },
    },
    select: {
      id: true,
    },
  });
  const remainingProductionEnvironment = await prisma.environment.findFirst({
    where: {
      projectId: remainingProject.id,
      type: "production",
    },
    select: {
      id: true,
    },
  });
  const remainingProductionEnvironmentId = remainingProductionEnvironment?.id;

  if (!remainingProductionEnvironmentId) {
    throw new Error("Remaining project production environment not found");
  }

  await user.login();
  await page.goto(`/environments/${project.productionEnvironmentId}/workspace/general`, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();

  await page.locator("#deleteProjectConfirmation").fill(project.projectName.toUpperCase());
  await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Workspace deleted successfully", { exact: true })).toBeVisible();
  await page.waitForURL(new RegExp(`/environments/${remainingProductionEnvironmentId}/surveys`));
  await expect.poll(async () => prisma.project.findUnique({ where: { id: project.projectId } })).toBeNull();
});
