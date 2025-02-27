import { contactAttributeKeyPaths } from "@/modules/api/v2/management/contact-attribute-keys/lib/openapi";
import { contactAttributePaths } from "@/modules/api/v2/management/contact-attributes/lib/openapi";
import { contactPaths } from "@/modules/api/v2/management/contacts/lib/openapi";
import { responsePaths } from "@/modules/api/v2/management/responses/lib/openapi";
import { surveyPaths } from "@/modules/api/v2/management/surveys/lib/openapi";
import * as yaml from "yaml";
import { z } from "zod";
import { createDocument, extendZodWithOpenApi } from "zod-openapi";
import { ZContact } from "@formbricks/database/zod/contact";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";
import { ZContactAttribute } from "@formbricks/database/zod/contact-attributes";
import { ZResponse } from "@formbricks/database/zod/responses";
import { ZSurvey } from "@formbricks/database/zod/surveys";

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
    ...contactPaths,
    ...contactAttributePaths,
    ...contactAttributeKeyPaths,
    ...surveyPaths,
  },
  servers: [
    {
      url: "https://app.formbricks.com/api",
      description: "Formbricks Cloud",
    },
  ],
  tags: [
    {
      name: "Responses",
      description: "Operations for managing responses.",
    },
    {
      name: "Contacts",
      description: "Operations for managing contacts.",
    },
    {
      name: "Contact Attributes",
      description: "Operations for managing contact attributes.",
    },
    {
      name: "Contact Attributes Keys",
      description: "Operations for managing contact attributes keys.",
    },
    {
      name: "Surveys",
      description: "Operations for managing surveys.",
    },
  ],
  components: {
    schemas: {
      response: ZResponse,
      contact: ZContact,
      contactAttribute: ZContactAttribute,
      contactAttributeKey: ZContactAttributeKey,
      survey: ZSurvey,
    },
  },
});

console.log(yaml.stringify(document));
