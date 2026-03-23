import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";

const bulkContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "uploadBulkContacts",
  summary: "Upload Bulk Contacts",
  description:
    "Uploads contacts in bulk. This endpoint expects the bulk request shape: `contacts` must be an array, and each contact item must contain an `attributes` array of `{ attributeKey, value }` objects. Unlike `POST /management/contacts`, this endpoint does not accept a top-level `attributes` object. Each contact must include an `email` attribute in its `attributes` array, and that email must be valid.",
  requestBody: {
    required: true,
    description:
      "The contacts to upload. Use the full nested bulk body shown in the example or cURL snippet: `{ environmentId, contacts: [{ attributes: [{ attributeKey: { key, name }, value }] }] }`. Each contact must include an `email` attribute inside its `attributes` array.",
    content: {
      "application/json": {
        schema: ZContactBulkUploadRequest,
        example: {
          environmentId: "env_01h2xce9q8p3w4x5y6z7a8b9c0",
          contacts: [
            {
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
              ],
            },
            {
              attributes: [
                {
                  attributeKey: {
                    key: "email",
                    name: "Email Address",
                  },
                  value: "jane.smith@example.com",
                },
                {
                  attributeKey: {
                    key: "firstName",
                    name: "First Name",
                  },
                  value: "Jane",
                },
                {
                  attributeKey: {
                    key: "lastName",
                    name: "Last Name",
                  },
                  value: "Smith",
                },
              ],
            },
          ],
        },
      },
    },
  },
  tags: ["Management API - Contacts"],
  responses: {
    "200": {
      description: "Contacts uploaded successfully.",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              status: z.string(),
              message: z.string(),
            }),
          }),
        },
      },
    },
    "207": {
      description: "Contacts uploaded partially successfully.",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              status: z.string(),
              message: z.string(),
              skippedContacts: z.array(
                z.object({
                  index: z.number(),
                  userId: z.string(),
                })
              ),
            }),
          }),
        },
      },
    },
  },
};

export const bulkContactPaths: ZodOpenApiPathsObject = {
  "/management/contacts/bulk": {
    put: bulkContactEndpoint,
  },
};
