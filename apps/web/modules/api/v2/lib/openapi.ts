import {
  ZContactAttributeKeyInput,
  ZGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import {
  ZContactAttributeInput,
  ZGetContactAttributesFilter,
} from "@/modules/api/v2/management/contact-attributes/types/contact-attributes";
import { ZContactInput, ZGetContactsFilter } from "@/modules/api/v2/management/contacts/types/contacts";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { ZGetSurveysFilter, ZSurveyInput } from "@/modules/api/v2/management/surveys/types/surveys";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZContact } from "@formbricks/database/zod/contact";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";
import { ZContactAttribute } from "@formbricks/database/zod/contact-attributes";
import { ZResponse } from "@formbricks/database/zod/responses";
import { ZSurvey } from "@formbricks/database/zod/surveys";

export const getResponsesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getResponses",
  summary: "Get responses",
  description: "Gets responses from the database.",
  requestParams: {
    query: ZGetResponsesFilter.sourceType().required(),
  },
  tags: ["responses"],
  responses: {
    "200": {
      description: "Responses retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZResponse),
        },
      },
    },
  },
};

export const createResponseEndpoint: ZodOpenApiOperationObject = {
  operationId: "createResponse",
  summary: "Create a response",
  description: "Creates a response in the database.",
  tags: ["responses"],
  requestBody: {
    required: true,
    description: "The response to create",
    content: {
      "application/json": {
        schema: ZResponseInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Response created successfully.",
      content: {
        "application/json": {
          schema: ZResponse,
        },
      },
    },
  },
};

export const getSurveysEndpoint: ZodOpenApiOperationObject = {
  operationId: "getSurveys",
  summary: "Get surveys",
  description: "Gets surveys from the database.",
  requestParams: {
    query: ZGetSurveysFilter,
  },
  tags: ["surveys"],
  responses: {
    "200": {
      description: "Surveys retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZSurvey),
        },
      },
    },
  },
};

export const createSurveyEndpoint: ZodOpenApiOperationObject = {
  operationId: "createSurvey",
  summary: "Create a survey",
  description: "Creates a survey in the database.",
  tags: ["surveys"],
  requestBody: {
    required: true,
    description: "The survey to create",
    content: {
      "application/json": {
        schema: ZSurveyInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Survey created successfully.",
      content: {
        "application/json": {
          schema: ZSurvey,
        },
      },
    },
  },
};

export const getContactsEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContacts",
  summary: "Get contacts",
  description: "Gets contacts from the database.",
  requestParams: {
    query: ZGetContactsFilter,
  },
  tags: ["contacts"],
  responses: {
    "200": {
      description: "Contacts retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZContact),
        },
      },
    },
  },
};

export const createContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "createContact",
  summary: "Create a contact",
  description: "Creates a contact in the database.",
  tags: ["contacts"],
  requestBody: {
    required: true,
    description: "The contact to create",
    content: {
      "application/json": {
        schema: ZContactInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Contact created successfully.",
      content: {
        "application/json": {
          schema: ZContact,
        },
      },
    },
  },
};

export const getContactAttributesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttributes",
  summary: "Get contact attributes",
  description: "Gets contact attributes from the database.",
  tags: ["contact-attributes"],
  requestParams: {
    query: ZGetContactAttributesFilter,
  },
  responses: {
    "200": {
      description: "Contact attributes retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZContactAttribute),
        },
      },
    },
  },
};

export const createContactAttributeEndpoint: ZodOpenApiOperationObject = {
  operationId: "createContactAttribute",
  summary: "Create a contact attribute",
  description: "Creates a contact attribute in the database.",
  tags: ["contact-attributes"],
  requestBody: {
    required: true,
    description: "The contact attribute to create",
    content: {
      "application/json": {
        schema: ZContactAttributeInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Contact attribute created successfully.",
    },
  },
};

export const getContactAttributeKeysEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttributeKeys",
  summary: "Get contact attribute keys",
  description: "Gets contact attribute keys from the database.",
  tags: ["contact-attribute-keys"],
  requestParams: {
    query: ZGetContactAttributeKeysFilter,
  },
  responses: {
    "200": {
      description: "Contact attribute keys retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZContactAttributeKey),
        },
      },
    },
  },
};

export const createContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "createContactAttributeKey",
  summary: "Create a contact attribute key",
  description: "Creates a contact attribute key in the database.",
  tags: ["contact-attribute-keys"],
  requestBody: {
    required: true,
    description: "The contact attribute key to create",
    content: {
      "application/json": {
        schema: ZContactAttributeKeyInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Contact attribute key created successfully.",
    },
  },
};
