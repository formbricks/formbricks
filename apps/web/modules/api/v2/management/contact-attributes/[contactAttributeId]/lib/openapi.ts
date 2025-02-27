import { ZContactAttributeInput } from "@/modules/api/v2/management/contact-attributes/types/contact-attributes";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZContactAttribute } from "@formbricks/database/zod/contact-attributes";

export const getContactAttributeEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttribute",
  summary: "Get a contact attribute",
  description: "Gets a contact attribute from the database.",
  requestParams: {
    path: z.object({
      contactAttributeId: z.string().cuid2(),
    }),
  },
  tags: ["contact-attributes"],
  responses: {
    "200": {
      description: "Contact retrieved successfully.",
      content: {
        "application/json": {
          schema: ZContactAttribute,
        },
      },
    },
  },
};

export const deleteContactAttributeEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteContactAttribute",
  summary: "Delete a contact attribute",
  description: "Deletes a contact attribute from the database.",
  tags: ["contact-attributes"],
  requestParams: {
    path: z.object({
      contactAttributeId: z.string().cuid2(),
    }),
  },
  responses: {
    "200": {
      description: "Contact deleted successfully.",
      content: {
        "application/json": {
          schema: ZContactAttribute,
        },
      },
    },
  },
};

export const updateContactAttributeEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateContactAttribute",
  summary: "Update a contact attribute",
  description: "Updates a contact attribute in the database.",
  tags: ["contact-attributes"],
  requestParams: {
    path: z.object({
      contactAttributeId: z.string().cuid2(),
    }),
  },
  requestBody: {
    required: true,
    description: "The response to update",
    content: {
      "application/json": {
        schema: ZContactAttributeInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Response updated successfully.",
      content: {
        "application/json": {
          schema: ZContactAttribute,
        },
      },
    },
  },
};
