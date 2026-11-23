import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { ZContactCreateRequest, ZContactResponse } from "@/modules/ee/contacts/types/contact";

export const createContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "createContact",
  summary: "Create a contact",
  description:
    "Creates a single contact in the database. This endpoint expects a top-level `attributes` object. For bulk uploads, use `PUT /management/contacts/bulk`, which expects `contacts[].attributes[]` instead. The contact must carry the matching key of the workspace's contact directory in its attributes: a valid `email`, or `externalId` for a directory matched by external ID. All attribute keys must already exist in the directory. The matching key and `userId` must not belong to another contact of the directory. A workspace with no contact directory gets 403.",
  tags: ["Management API - Contacts"],

  requestBody: {
    required: true,
    description:
      "The single contact to create. Must include a top-level `attributes` object with the directory's matching key (`email` or `externalId`), and all attribute keys must already exist in the directory.",
    content: {
      "application/json": {
        schema: ZContactCreateRequest,
        example: {
          workspaceId: "cm01h2xce9q8p3w4x5y6z7a8b9c0",
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

  responses: {
    "201": {
      description: "Contact created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZContactResponse),
          example: {
            id: "ctc_01h2xce9q8p3w4x5y6z7a8b9c2",
            createdAt: "2023-01-01T12:00:00.000Z",
            workspaceId: "cm01h2xce9q8p3w4x5y6z7a8b9c0",
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
};

export const contactPaths: ZodOpenApiPathsObject = {
  "/management/contacts": {
    post: createContactEndpoint,
  },
};
