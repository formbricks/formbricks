import { contactAttributeKeyPaths } from "@/modules/api/v2/management/contact-attribute-keys/lib/openapi";
import { contactAttributePaths } from "@/modules/api/v2/management/contact-attributes/lib/openapi";
import { contactPaths } from "@/modules/api/v2/management/contacts/lib/openapi";
import { responsePaths } from "@/modules/api/v2/management/responses/lib/openapi";
import { surveyPaths } from "@/modules/api/v2/management/surveys/lib/openapi";
import { webhookPaths } from "@/modules/api/v2/management/webhooks/lib/openapi";
import { mePaths } from "@/modules/api/v2/me/lib/openapi";
import { projectTeamPaths } from "@/modules/api/v2/organizations/[organizationId]/project-teams/lib/openapi";
import { teamPaths } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/openapi";
import { userPaths } from "@/modules/api/v2/organizations/[organizationId]/users/lib/openapi";
import { rolePaths } from "@/modules/api/v2/roles/lib/openapi";
import { bulkContactPaths } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/openapi";
import * as yaml from "yaml";
import { z } from "zod";
import { createDocument, extendZodWithOpenApi } from "zod-openapi";
import { ZApiKeyData } from "@formbricks/database/zod/api-keys";
import { ZContact } from "@formbricks/database/zod/contact";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";
import { ZContactAttribute } from "@formbricks/database/zod/contact-attributes";
import { ZProjectTeam } from "@formbricks/database/zod/project-teams";
import { ZResponse } from "@formbricks/database/zod/responses";
import { ZRoles } from "@formbricks/database/zod/roles";
import { ZSurveyWithoutQuestionType } from "@formbricks/database/zod/surveys";
import { ZTeam } from "@formbricks/database/zod/teams";
import { ZUser } from "@formbricks/database/zod/users";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

extendZodWithOpenApi(z);

const document = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Formbricks API",
    description: "Manage Formbricks resources programmatically.",
    version: "2.0.0",
  },
  paths: {
    ...rolePaths,
    ...mePaths,
    ...responsePaths,
    ...bulkContactPaths,
    ...contactPaths,
    ...contactAttributePaths,
    ...contactAttributeKeyPaths,
    ...surveyPaths,
    ...webhookPaths,
    ...teamPaths,
    ...projectTeamPaths,
    ...userPaths,
  },
  servers: [
    {
      url: "https://app.formbricks.com/api/v2/",
      description: "Formbricks Cloud",
    },
  ],
  tags: [
    {
      name: "Roles",
      description: "Operations for managing roles.",
    },
    {
      name: "Me",
      description: "Operations for managing your API key.",
    },
    {
      name: "Management API > Responses",
      description: "Operations for managing responses.",
    },
    {
      name: "Management API > Contacts",
      description: "Operations for managing contacts.",
    },
    {
      name: "Management API > Contact Attributes",
      description: "Operations for managing contact attributes.",
    },
    {
      name: "Management API > Contact Attributes Keys",
      description: "Operations for managing contact attributes keys.",
    },
    {
      name: "Management API > Surveys",
      description: "Operations for managing surveys.",
    },
    {
      name: "Management API > Webhooks",
      description: "Operations for managing webhooks.",
    },
    {
      name: "Organizations API > Teams",
      description: "Operations for managing teams.",
    },
    {
      name: "Organizations API > Project Teams",
      description: "Operations for managing project teams.",
    },
    {
      name: "Organizations API > Users",
      description: "Operations for managing users.",
    },
  ],
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Use your Formbricks x-api-key to authenticate.",
      },
    },
    schemas: {
      role: ZRoles,
      me: ZApiKeyData,
      response: ZResponse,
      contact: ZContact,
      contactAttribute: ZContactAttribute,
      contactAttributeKey: ZContactAttributeKey,
      survey: ZSurveyWithoutQuestionType,
      webhook: ZWebhook,
      team: ZTeam,
      projectTeam: ZProjectTeam,
      user: ZUser,
    },
  },
  security: [
    {
      apiKeyAuth: [],
    },
  ],
});

// do not replace this with logger.info
console.log(yaml.stringify(document));
