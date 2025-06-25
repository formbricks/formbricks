import {
  ZContactAttributeKeyIdSchema,
  ZContactAttributeKeyUpdateSchema,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

export const getContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttributeKey",
  summary: "Get a contact attribute key",
  description: "Gets a contact attribute key from the database.",
  requestParams: {
    path: z.object({
      id: ZContactAttributeKeyIdSchema,
    }),
  },
  tags: ["Management API > Contact Attribute Keys"],
  responses: {
    "200": {
      description: "Contact attribute key retrieved successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZContactAttributeKey),
        },
      },
    },
  },
};

export const updateContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateContactAttributeKey",
  summary: "Update a contact attribute key",
  description: "Updates a contact attribute key in the database.",
  tags: ["Management API > Contact Attribute Keys"],
  requestParams: {
    path: z.object({
      id: ZContactAttributeKeyIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The contact attribute key to update",
    content: {
      "application/json": {
        schema: ZContactAttributeKeyUpdateSchema,
      },
    },
  },
  responses: {
    "200": {
      description: "Contact attribute key updated successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZContactAttributeKey),
        },
      },
    },
  },
};

export const deleteContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteContactAttributeKey",
  summary: "Delete a contact attribute key",
  description: "Deletes a contact attribute key from the database.",
  tags: ["Management API > Contact Attribute Keys"],
  requestParams: {
    path: z.object({
      id: ZContactAttributeKeyIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Contact attribute key deleted successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZContactAttributeKey),
        },
      },
    },
  },
};
