import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { ZContactCreateRequest, ZContactResponse } from "@/modules/ee/contacts/types/contact";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";

export const createContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "createContact",
  summary: "Create a contact",
  description:
    "Creates a contact in the database. Each contact must have a valid email address in the attributes. The email is used as the unique identifier along with the environment.",
  tags: ["Management API - Contacts"],

  requestBody: {
    required: true,
    description:
      "The contact to create. Must include an email attribute and all attributes must have unique keys.",
    content: {
      "application/json": {
        schema: ZContactCreateRequest,
        example: {
          environmentId: "env_01h2xce9q8p3w4x5y6z7a8b9c0",
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email Address",
              },
              value: "john.doe@example.com",
            },
            {
              attributeKey: {
                key: "firstName",
                name: "First Name",
              },
              value: "John",
            },
            {
              attributeKey: {
                key: "lastName",
                name: "Last Name",
              },
              value: "Doe",
            },
            {
              attributeKey: {
                key: "userId",
                name: "User ID",
              },
              value: "h2xce9q8p3w4x5y6z7a8b9c1",
            },
          ],
        },
      },
    },
  },

  responses: {
    "201": {
      description: "Contact created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZContactResponse),
          example: {
            data: {
              id: "ctc_01h2xce9q8p3w4x5y6z7a8b9c2",
              createdAt: "2023-01-01T12:00:00.000Z",
              environmentId: "env_01h2xce9q8p3w4x5y6z7a8b9c0",
              attributes: {
                email: "john.doe@example.com",
                firstName: "John",
                lastName: "Doe",
                userId: "h2xce9q8p3w4x5y6z7a8b9c1",
              },
            },
          },
        },
      },
    },
  },
};

export const contactPaths: ZodOpenApiPathsObject = {
  "/contacts": {
    servers: managementServer,
    post: createContactEndpoint,
  },
};
