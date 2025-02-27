import { ZContactInput } from "@/modules/api/v2/management/contacts/types/contacts";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZContact } from "@formbricks/database/zod/contact";

export const getContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContact",
  summary: "Get a contact",
  description: "Gets a contact from the database.",
  requestParams: {
    path: z.object({
      contactId: z.string().cuid2(),
    }),
  },
  tags: ["contacts"],
  responses: {
    "200": {
      description: "Contact retrieved successfully.",
      content: {
        "application/json": {
          schema: ZContact,
        },
      },
    },
  },
};

export const deleteContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteContact",
  summary: "Delete a contact",
  description: "Deletes a contact from the database.",
  tags: ["contacts"],
  requestParams: {
    path: z.object({
      contactId: z.string().cuid2(),
    }),
  },
  responses: {
    "200": {
      description: "Contact deleted successfully.",
      content: {
        "application/json": {
          schema: ZContact,
        },
      },
    },
  },
};

export const updateContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateContact",
  summary: "Update a contact",
  description: "Updates a contact in the database.",
  tags: ["contacts"],
  requestParams: {
    path: z.object({
      contactId: z.string().cuid2(),
    }),
  },
  requestBody: {
    required: true,
    description: "The response to update",
    content: {
      "application/json": {
        schema: ZContactInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Response updated successfully.",
      content: {
        "application/json": {
          schema: ZContact,
        },
      },
    },
  },
};
