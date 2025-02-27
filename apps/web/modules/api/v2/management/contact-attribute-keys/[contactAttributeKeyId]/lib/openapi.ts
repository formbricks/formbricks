import { ZContactAttributeKeyInput } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

export const getContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttributeKey",
  summary: "Get a contact attribute key",
  description: "Gets a contact attribute key from the database.",
  requestParams: {
    path: z.object({
      contactAttributeKeyId: z.string().cuid2(),
    }),
  },
  tags: ["contact-attribute-keys"],
  responses: {
    "200": {
      description: "Contact attribute key retrieved successfully.",
      content: {
        "application/json": {
          schema: ZContactAttributeKey,
        },
      },
    },
  },
};

export const deleteContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteContactAttributeKey",
  summary: "Delete a contact attribute key",
  description: "Deletes a contact attribute key from the database.",
  tags: ["contact-attribute-keys"],
  requestParams: {
    path: z.object({
      contactAttributeId: z.string().cuid2(),
    }),
  },
  responses: {
    "200": {
      description: "Contact attribute key deleted successfully.",
      content: {
        "application/json": {
          schema: ZContactAttributeKey,
        },
      },
    },
  },
};

export const updateContactAttributeKeyEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateContactAttributeKey",
  summary: "Update a contact attribute key",
  description: "Updates a contact attribute key in the database.",
  tags: ["contact-attribute-keys"],
  requestParams: {
    path: z.object({
      contactAttributeKeyId: z.string().cuid2(),
    }),
  },
  requestBody: {
    required: true,
    description: "The contact attribute key to update",
    content: {
      "application/json": {
        schema: ZContactAttributeKeyInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Contact attribute key updated successfully.",
      content: {
        "application/json": {
          schema: ZContactAttributeKey,
        },
      },
    },
  },
};
