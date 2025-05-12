import { createId } from "@paralleldrive/cuid2";
import { hash } from "bcryptjs";
import { logger } from "@formbricks/logger";
import { ZProject } from "../../../types/project";
import { ZUserEmail, ZUserPassword } from "../../../types/user";
import { ZOrganization } from "../../zod/organizations";
import { prisma } from "../client";

const { INITIAL_USER_EMAIL, INITIAL_USER_PASSWORD, INITIAL_ORGANIZATION_NAME, INITIAL_PROJECT_NAME } =
  process.env;

export const isFreshInstance = async (): Promise<boolean> => {
  try {
    // Use raw queries to check if instance is fresh
    const [{ user_count: userCount }] = await prisma.$queryRaw<[{ user_count: number }]>`
      SELECT COUNT(*)::integer AS user_count FROM "User"
    `;

    const [{ org_count: organizationCount }] = await prisma.$queryRaw<[{ org_count: number }]>`
      SELECT COUNT(*)::integer AS org_count FROM "Organization"
    `;

    return userCount === 0 && organizationCount === 0;
  } catch (error) {
    logger.error("Error checking if instance is fresh:", error);
    return false;
  }
};

const isValidEmail = (email: string): boolean => {
  const parseResult = ZUserEmail.safeParse(email);
  return parseResult.success;
};

const isValidPassword = (password: string): boolean => {
  const parseResult = ZUserPassword.safeParse(password);
  return parseResult.success;
};

const isValidOrganizationName = (name: string): boolean => {
  const parseResult = ZOrganization.pick({ name: true }).safeParse({ name });
  return parseResult.success;
};

const isValidProjectName = (name: string): boolean => {
  const parseResult = ZProject.pick({ name: true }).safeParse({ name });
  return parseResult.success;
};

const validateEnvironmentVariables = (): boolean => {
  if (INITIAL_USER_EMAIL && !isValidEmail(INITIAL_USER_EMAIL)) {
    logger.error("Invalid email format. Please provide a valid email.");
    return false;
  }
  if (INITIAL_USER_PASSWORD && !isValidPassword(INITIAL_USER_PASSWORD)) {
    logger.error("Invalid password format. Please provide a valid password.");
    return false;
  }
  if (INITIAL_ORGANIZATION_NAME && !isValidOrganizationName(INITIAL_ORGANIZATION_NAME)) {
    logger.error("Invalid organization name format. Please provide a valid organization name.");
    return false;
  }
  if (INITIAL_PROJECT_NAME && !isValidProjectName(INITIAL_PROJECT_NAME)) {
    logger.error("Invalid project name format. Please provide a valid project name.");
    return false;
  }
  return true;
};

const createInitialUser = async (
  email: string,
  password: string,
  organizationName?: string,
  projectName?: string
): Promise<void> => {
  const hashedPassword = await hash(password, 12);
  const userId = createId();
  const now = new Date();

  // Start a transaction for all operations
  await prisma.$transaction(async (tx) => {
    if (!organizationName) {
      // Create only a user without an organization using raw query
      await tx.$executeRaw`
        INSERT INTO "User" (
          "id", 
          "created_at", 
          "updated_at", 
          "name", 
          "email", 
          "password", 
          "email_verified", 
          "locale"
        ) VALUES (
          ${userId}, 
          ${now}, 
          ${now}, 
          'Admin', 
          ${email.toLowerCase()}, 
          ${hashedPassword}, 
          ${now}, 
          'en-US'
        )
      `;
      return;
    }

    // Create user with organization and optional project
    const organizationId = createId();

    // Create user
    await tx.$executeRaw`
      INSERT INTO "User" (
        "id", 
        "created_at", 
        "updated_at", 
        "name", 
        "email", 
        "password", 
        "email_verified", 
        "locale"
      ) VALUES (
        ${userId}, 
        ${now}, 
        ${now}, 
        'Admin', 
        ${email.toLowerCase()}, 
        ${hashedPassword}, 
        ${now}, 
        'en-US'
      )
    `;

    // Create organization with billing information
    const billingData = JSON.stringify({
      plan: "free",
      limits: { projects: 3, monthly: { responses: 1500, miu: 2000 } },
      stripeCustomerId: null,
      periodStart: now,
      period: "monthly",
    });

    await tx.$executeRaw`
      INSERT INTO "Organization" (
        "id", 
        "created_at", 
        "updated_at", 
        "name", 
        "billing",
        "whitelabel",
        "isAIEnabled"
      ) VALUES (
        ${organizationId}, 
        ${now}, 
        ${now}, 
        ${organizationName}, 
        ${billingData}::jsonb,
        '{}'::jsonb,
        false
      )
    `;

    // Create membership linking user to organization
    await tx.$executeRaw`
      INSERT INTO "Membership" (
        "userId", 
        "organizationId", 
        "accepted", 
        "role"
      ) VALUES (
        ${userId}, 
        ${organizationId}, 
        true, 
        'owner'
      )
    `;

    if (projectName) {
      // Create project
      const projectId = createId();

      await tx.$executeRaw`
        INSERT INTO "Project" (
          "id",
          "created_at",
          "updated_at",
          "name",
          "organizationId",
          "styling",
          "config",
          "recontactDays",
          "linkSurveyBranding",
          "inAppSurveyBranding", 
          "placement",
          "clickOutsideClose",
          "darkOverlay"
        ) VALUES (
          ${projectId},
          ${now},
          ${now},
          ${projectName},
          ${organizationId},
          '{}'::jsonb,
          '{"channel": "link"}'::jsonb,
          7,
          true,
          true,
          'bottomRight',
          true,
          false
        )
      `;

      // Create development environment
      const devEnvironmentId = createId();

      await tx.$executeRaw`
        INSERT INTO "Environment" (
          "id",
          "created_at",
          "updated_at",
          "type",
          "projectId",
          "widgetSetupCompleted",
          "appSetupCompleted"
        ) VALUES (
          ${devEnvironmentId},
          ${now},
          ${now},
          'development',
          ${projectId},
          false,
          false
        )
      `;

      // Create production environment
      const prodEnvironmentId = createId();

      await tx.$executeRaw`
        INSERT INTO "Environment" (
          "id",
          "created_at",
          "updated_at",
          "type",
          "projectId",
          "widgetSetupCompleted",
          "appSetupCompleted" 
        ) VALUES (
          ${prodEnvironmentId},
          ${now},
          ${now},
          'production',
          ${projectId},
          false,
          false
        )
      `;
    }
  });
};

const initialUserSetup = async (): Promise<boolean> => {
  try {
    logger.info("Checking if initial environment setup is needed...");
    if (!validateEnvironmentVariables()) {
      return false;
    }

    if (!INITIAL_USER_EMAIL || !INITIAL_USER_PASSWORD) {
      logger.info("No initial user credentials provided. Skipping automated setup.");
      return true;
    }

    const freshInstance = await isFreshInstance();
    if (!freshInstance) {
      logger.info("Not a fresh instance (users or organizations exist). Skipping initial setup.");
      return true;
    }

    logger.info("Fresh instance detected. Creating initial admin user...");
    await createInitialUser(
      INITIAL_USER_EMAIL,
      INITIAL_USER_PASSWORD,
      INITIAL_ORGANIZATION_NAME,
      INITIAL_PROJECT_NAME
    );

    logger.info(`
✅ Successfully created initial admin user${INITIAL_ORGANIZATION_NAME ? " and organization" : ""}:
- Email: ${INITIAL_USER_EMAIL}
${INITIAL_ORGANIZATION_NAME ? `- Organization: ${INITIAL_ORGANIZATION_NAME}` : ""}
${INITIAL_PROJECT_NAME && INITIAL_ORGANIZATION_NAME ? `- Project: ${INITIAL_PROJECT_NAME}` : ""}

You can now log in with the credentials provided in the environment variables.
        `);

    return true;
  } catch (error) {
    console.error("Error during initial environment setup:", error);
    logger.error("Error during initial environment setup:", error);
    return false;
  }
};

initialUserSetup()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error(error, "Error during initial user setup");
  });
