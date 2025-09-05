import * as fs from "fs";
import * as yaml from "yaml";
import { logger } from "@formbricks/logger";

// Define the v1 (now v2) client endpoints to be merged
const v1ClientEndpoints = {
  "/client/{environmentId}/responses/{responseId}": {
    put: {
      security: [],
      description:
        "Update an existing response for example when you want to mark a response as finished or you want to change an existing response's value.",
      parameters: [
        {
          in: "path",
          name: "environmentId",
          required: true,
          schema: { type: "string" },
          description: "The ID of the environment.",
        },
        {
          in: "path",
          name: "responseId",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              example: {
                data: { tcgls0063n8ri7dtrbnepcmz: "Who? Who? Who?" },
                finished: true,
              },
              type: "object",
            },
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              example: { data: {} },
              schema: { type: "object" },
            },
          },
          description: "OK",
        },
        "404": {
          content: {
            "application/json": {
              example: {
                code: "not_found",
                details: { resource_type: "Response" },
                message: "Response not found",
              },
              schema: { type: "object" },
            },
          },
          description: "Not Found",
        },
      },
      summary: "Update Response",
      tags: ["Client API - Response"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/responses": {
    post: {
      security: [],
      description:
        "Create a response for a survey and its fields with the user's responses. The userId & meta here is optional",
      requestBody: {
        content: {
          "application/json": {
            schema: { example: { surveyId: "survey123", responses: {} }, type: "object" },
          },
        },
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              example: { responseId: "response123" },
              schema: { type: "object" },
            },
          },
          description: "Created",
        },
      },
      summary: "Create Response",
      tags: ["Client API - Response"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/contacts/{userId}/attributes": {
    put: {
      security: [],
      description:
        "Update a contact's attributes in Formbricks to keep them in sync with your app or when you want to set a custom attribute in Formbricks.",
      parameters: [
        { in: "path", name: "environmentId", required: true, schema: { type: "string" } },
        { in: "path", name: "userId", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: { example: { attributes: {} }, type: "object" },
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              examples: { "example-0": {}, "example-1": {} },
              schema: { type: "object" },
            },
          },
          description: "OK",
        },
        "500": {
          content: {
            "application/json": {
              example: {
                code: "internal_server_error",
                details: {},
                message: "Unable to complete request: Expected",
              },
              schema: { type: "object" },
            },
          },
          description: "Internal Server Error",
        },
      },
      summary: "Update Contact (Attributes)",
      tags: ["Client API - Contacts"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/identify/contacts/{userId}": {
    get: {
      security: [],
      description:
        "Retrieves a contact's state including their segments, displays, responses and other tracking information. If the contact doesn't exist, it will be created.",
      parameters: [
        { in: "path", name: "environmentId", required: true, schema: { type: "string" } },
        { in: "path", name: "userId", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              example: { userId: "user123", state: "active" },
              schema: { type: "object" },
            },
          },
          description: "OK",
        },
      },
      summary: "Get Contact State",
      tags: ["Client API - Contacts"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/displays": {
    post: {
      security: [],
      description:
        "Create a new display for a valid survey ID. If a userId is passed, the display is linked to the user.",
      requestBody: {
        content: {
          "application/json": {
            schema: { example: { surveyId: "survey123", userId: "user123" }, type: "object" },
          },
        },
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              example: { displayId: "display123" },
              schema: { type: "object" },
            },
          },
          description: "Created",
        },
      },
      summary: "Create Display",
      tags: ["Client API - Display"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/environment": {
    get: {
      security: [],
      description:
        "Retrieves the environment state to be used in Formbricks SDKs. **Cache Behavior**: This endpoint uses server-side caching with a **5-minute TTL (Time To Live)**. Any changes to surveys, action classes, project settings, or other environment data will take up to 5 minutes to reflect in the API response. This caching is implemented to improve performance for high-frequency SDK requests.",
      parameters: [
        {
          in: "path",
          name: "environmentId",
          required: true,
          schema: { type: "string" },
          description: "The ID of the environment.",
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              example: { environmentId: "env123", state: "active" },
              schema: { type: "object" },
            },
          },
          description: "OK",
        },
      },
      summary: "Get Environment State",
      tags: ["Client API - Environment"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/user": {
    post: {
      security: [],
      description:
        "Endpoint for creating or identifying a user within the specified environment. If the user already exists, this will identify them and potentially update user attributes. If they don't exist, it will create a new user.",
      requestBody: {
        content: {
          "application/json": {
            schema: { example: { userId: "user123", attributes: {} }, type: "object" },
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              example: { userId: "user123", state: "identified" },
              schema: { type: "object" },
            },
          },
          description: "OK",
        },
      },
      summary: "Create or Identify User",
      tags: ["Client API - User"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/client/{environmentId}/storage": {
    post: {
      security: [],
      summary: "Upload Private File",
      description:
        "API endpoint for uploading private files. Uploaded files are kept private so that only users with access to the specified environment can retrieve them. The endpoint validates the survey ID, file name, and file type from the request body, and returns a signed URL for S3 uploads along with a local upload URL.",
      tags: ["Client API - File Upload"],
      parameters: [
        {
          in: "path",
          name: "environmentId",
          required: true,
          schema: {
            type: "string",
          },
          description: "The ID of the environment.",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                surveyId: {
                  type: "string",
                  description: "The ID of the survey associated with the file.",
                },
                fileName: {
                  type: "string",
                  description: "The name of the file to be uploaded.",
                },
                fileType: {
                  type: "string",
                  description: "The MIME type of the file.",
                },
              },
              required: ["surveyId", "fileName", "fileType"],
              example: {
                surveyId: "cm7pr0x2y004o192zmit8cjvb",
                fileName: "example.jpg",
                fileType: "image/jpeg",
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "OK - Returns the signed URL, presigned fields, updated file name, and file URL.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      signedUrl: {
                        type: "string",
                        description: "Presigned POST URL for uploading the file to S3-compatible storage.",
                      },
                      presignedFields: {
                        type: "object",
                        additionalProperties: { type: "string" },
                        description: "Presigned POST form fields required by S3-compatible storage.",
                      },

                      updatedFileName: {
                        type: "string",
                        description: "The updated file name after processing.",
                      },
                      fileUrl: {
                        type: "string",
                        description: "URL where the uploaded file can be accessed.",
                      },
                    },
                  },
                },
                example: {
                  data: {
                    signedUrl: "https://s3.example.com/bucket",
                    presignedFields: {
                      key: "uploads/env-id/private/file--fid--uuid.jpg",
                      policy: "<base64-policy>",
                      "x-amz-algorithm": "AWS4-HMAC-SHA256",
                    },
                    updatedFileName: "file--fid--b153ba3e-6602-4bb3-bed9-211b5b1ae463.jpg",
                    fileUrl:
                      "https://app.formbricks.com/storage/cm1ubebtj000614kqe4hs3c67/private/file--fid--b153ba3e-6602-4bb3-bed9-211b5b1ae463.jpg",
                  },
                },
              },
            },
          },
        },
        "400": {
          description: "Bad Request - One or more required fields are missing.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    description: "Detailed error message.",
                  },
                },
                example: {
                  error: "fileName is required",
                },
              },
            },
          },
        },
        "404": {
          description: "Not Found - The specified survey or organization does not exist.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    description: "Detailed error message.",
                  },
                },
                example: {
                  error: "Survey survey123 not found",
                },
              },
            },
          },
        },
      },
      servers: [
        {
          url: "https://app.formbricks.com/api/v2",
          description: "Formbricks API Server",
        },
      ],
    },
  },
};

// Read the generated openapi.yml file
const openapiFilePath = "../../docs/api-v2-reference/openapi.yml";
const openapiContent = fs.readFileSync(openapiFilePath, "utf8");

// Parse the YAML content
const openapiDoc = yaml.parse(openapiContent);

// Merge the v1 client endpoints into the parsed content
openapiDoc.paths = {
  ...v1ClientEndpoints,
  ...openapiDoc.paths,
};

// Write the updated content back to the openapi.yml file
const updatedOpenapiContent = yaml.stringify(openapiDoc);

// Write the updated content back to the openapi.yml file
try {
  fs.writeFileSync(openapiFilePath, updatedOpenapiContent);
  logger.info("Merged v1 client endpoints into the generated v2 documentation.");
} catch (error) {
  logger.error(error, "Error writing to OpenAPI file");
  process.exit(1);
}
