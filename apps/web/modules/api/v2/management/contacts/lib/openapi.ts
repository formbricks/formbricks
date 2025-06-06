import {
  deleteContactEndpoint,
  getContactEndpoint,
  updateContactEndpoint,
} from "@/modules/api/v2/management/contacts/[contactId]/lib/openapi";
import { ZContactInput, ZGetContactsFilter } from "@/modules/api/v2/management/contacts/types/contacts";
import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZContact } from "@formbricks/database/zod/contact";

export const getContactsEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContacts",
  summary: "Get contacts",
  description: "Gets contacts from the database.",
  requestParams: {
    query: ZGetContactsFilter,
  },
  tags: ["Management API > Contacts"],
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
  tags: ["Management API > Contacts"],
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

export const contactPaths: ZodOpenApiPathsObject = {
  "/contacts": {
    servers: managementServer,
    get: getContactsEndpoint,
    post: createContactEndpoint,
  },
  "/contacts/{id}": {
    servers: managementServer,
    get: getContactEndpoint,
    put: updateContactEndpoint,
    delete: deleteContactEndpoint,
  },
};
