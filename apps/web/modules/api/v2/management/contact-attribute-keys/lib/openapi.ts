import {
  deleteContactAttributeKeyEndpoint,
  getContactAttributeKeyEndpoint,
  updateContactAttributeKeyEndpoint,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/lib/openapi";
import {
  ZContactAttributeKeyInput,
  ZGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

export const getContactAttributeKeysEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttributeKeys",
  summary: "Get contact attribute keys",
  description: "Gets contact attribute keys from the database.",
  tags: ["Management API > Contact Attribute Keys"],
  requestParams: {
    query: ZGetContactAttributeKeysFilter.sourceType(),
  },
  responses: {
    "200": {
      description: "Contact attribute keys retrieved successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZContactAttributeKey)),
        },
      },
    },
  },
};

export const createContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "createContactAttributeKey",
  summary: "Create a contact attribute key",
  description: "Creates a contact attribute key in the database.",
  tags: ["Management API > Contact Attribute Keys"],
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
      content: {
        "application/json": {
          schema: makePartialSchema(ZContactAttributeKey),
        },
      },
    },
  },
};

export const contactAttributeKeyPaths: ZodOpenApiPathsObject = {
  "/contact-attribute-keys": {
    servers: managementServer,
    get: getContactAttributeKeysEndpoint,
    post: createContactAttributeKeyEndpoint,
  },
  "/contact-attribute-keys/{id}": {
    servers: managementServer,
    get: getContactAttributeKeyEndpoint,
    put: updateContactAttributeKeyEndpoint,
    delete: deleteContactAttributeKeyEndpoint,
  },
};
