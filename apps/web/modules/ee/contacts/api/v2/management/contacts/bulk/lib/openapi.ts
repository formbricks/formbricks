import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";

const bulkContactEndpoint: ZodOpenApiOperationObject = {
  operationId: "uploadBulkContacts",
  summary: "Upload Bulk Contacts",
  description: "Uploads contacts in bulk",
  requestBody: {
    required: true,
    description: "The contacts to upload",
    content: {
      "application/json": {
        schema: ZContactBulkUploadRequest,
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
    put: bulkContactEndpoint,
  },
};
