import { contactAttributeKeyPaths } from "@/modules/api/v2/management/contact-attribute-keys/lib/openapi";
import { contactAttributePaths } from "@/modules/api/v2/management/contact-attributes/lib/openapi";
import { contactPaths } from "@/modules/api/v2/management/contacts/lib/openapi";
import { responsePaths } from "@/modules/api/v2/management/responses/lib/openapi";
import { surveyPaths } from "@/modules/api/v2/management/surveys/lib/openapi";
import { webhookPaths } from "@/modules/api/v2/management/webhooks/lib/openapi";
import { bulkContactPaths } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/openapi";
import * as yaml from "yaml";
import { z } from "zod";
import { createDocument, extendZodWithOpenApi } from "zod-openapi";
import { ZContact } from "@formbricks/database/zod/contact";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";
import { ZContactAttribute } from "@formbricks/database/zod/contact-attributes";
import { ZResponse } from "@formbricks/database/zod/responses";
import { ZSurveyWithoutQuestionType } from "@formbricks/database/zod/surveys";
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
    ...responsePaths,
    ...bulkContactPaths,
    ...contactPaths,
    ...contactAttributePaths,
    ...contactAttributeKeyPaths,
    ...surveyPaths,
    ...webhookPaths,
  },
  servers: [
    {
      url: "https://app.formbricks.com/api/v2/management",
      description: "Formbricks Cloud",
    },
  ],
  tags: [
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
      response: ZResponse,
      contact: ZContact,
      contactAttribute: ZContactAttribute,
      contactAttributeKey: ZContactAttributeKey,
      survey: ZSurveyWithoutQuestionType,
      webhook: ZWebhook,
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
