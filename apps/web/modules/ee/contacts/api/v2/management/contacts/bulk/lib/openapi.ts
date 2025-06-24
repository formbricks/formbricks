import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";

const bulkContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "uploadBulkContacts",
  summary: "Upload Bulk Contacts",
  description:
    "Uploads contacts in bulk. Each contact in the payload must have an 'email' attribute present in their attributes array. The email attribute is mandatory and must be a valid email format.",
  requestBody: {
    required: true,
    description:
      "The contacts to upload. Each contact must include an 'email' attribute in their attributes array.",
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
  tags: ["Management API > Contacts"],
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
  "/contacts/bulk": {
    servers: managementServer,
    put: bulkContactEndpoint,
  },
};
