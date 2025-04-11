import {
  deleteContactAttributeEndpoint,
  getContactAttributeEndpoint,
  updateContactAttributeEndpoint,
} from "@/modules/api/v2/management/contact-attributes/[contactAttributeId]/lib/openapi";
import {
  ZContactAttributeInput,
  ZGetContactAttributesFilter,
} from "@/modules/api/v2/management/contact-attributes/types/contact-attributes";
import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZContactAttribute } from "@formbricks/types/contact-attribute";

export const getContactAttributesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactAttributes",
  summary: "Get contact attributes",
  description: "Gets contact attributes from the database.",
  tags: ["Management API > Contact Attributes"],
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
  tags: ["Management API > Contact Attributes"],
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

export const contactAttributePaths: ZodOpenApiPathsObject = {
  "/contact-attributes": {
    servers: managementServer,
    get: getContactAttributesEndpoint,
    post: createContactAttributeEndpoint,
  },
  "/contact-attributes/{id}": {
    servers: managementServer,
    get: getContactAttributeEndpoint,
    put: updateContactAttributeEndpoint,
    delete: deleteContactAttributeEndpoint,
  },
};
