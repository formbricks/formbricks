import * as fs from "fs";
import * as yaml from "yaml";

// Define the v1 (now v2) client endpoints to be merged
const v1ClientEndpoints = {
  "/responses/{responseId}": {
    put: {
      description:
        "Update an existing response for example when you want to mark a response as finished or you want to change an existing response's value.",
      parameters: [
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
      tags: ["Client API > Response"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/responses": {
    post: {
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
      tags: ["Client API > Response"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/contacts/{userId}/attributes": {
    put: {
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
      tags: ["Client API > Contacts"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/identify/contacts/{userId}": {
    get: {
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
      tags: ["Client API > Contacts"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/displays": {
    post: {
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
      tags: ["Client API > Display"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/displays/{displayId}": {
    put: {
      description:
        "Update a Display for a user. A use case can be when a user submits a response & you want to link it to an existing display.",
      parameters: [{ in: "path", name: "displayId", required: true, schema: { type: "string" } }],
      requestBody: {
        content: {
          "application/json": {
            schema: { example: { responseId: "response123" }, type: "object" },
          },
        },
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              example: { displayId: "display123" },
              schema: { type: "object" },
            },
          },
          description: "OK",
        },
      },
      summary: "Update Display",
      tags: ["Client API > Display"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/environment": {
    get: {
      description: "Retrieves the environment state to be used in Formbricks SDKs",
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
      tags: ["Client API > Environment"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  "/{environmentId}/user": {
    post: {
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
      tags: ["Client API > User"],
      servers: [
        {
          url: "https://app.formbricks.com/api/v2/client",
          description: "Formbricks Client",
        },
      ],
    },
  },
  // "/{environmentId}/storage": {
  //   post: {
  //     summary: "Upload Private File",
  //     description:
  //       "API endpoint for uploading private files. Uploaded files are kept private so that only users with access to the specified environment can retrieve them. The endpoint validates the survey ID, file name, and file type from the request body, and returns a signed URL for S3 uploads along with a local upload URL.",
  //     tags: ["Client API > File Upload"],
  //     parameters: [
  //       {
  //         in: "path",
  //         name: "environmentId",
  //         required: true,
  //         schema: {
  //           type: "string",
  //         },
  //         description: "The ID of the environment.",
  //       },
  //     ],
  //     requestBody: {
  //       required: true,
  //       content: {
  //         "application/json": {
  //           schema: {
  //             type: "object",
  //             properties: {
  //               surveyId: {
  //                 type: "string",
  //                 description: "The ID of the survey associated with the file.",
  //               },
  //               fileName: {
  //                 type: "string",
  //                 description: "The name of the file to be uploaded.",
  //               },
  //               fileType: {
  //                 type: "string",
  //                 description: "The MIME type of the file.",
  //               },
  //             },
  //             required: ["surveyId", "fileName", "fileType"],
  //           },
  //           example: {
  //             surveyId: "survey123",
  //             fileName: "example.jpg",
  //             fileType: "image/jpeg",
  //           },
  //         },
  //       },
  //     },
  //     responses: {
  //       "200": {
  //         description: "OK - Returns the signed S3 URL and the local upload URL.",
  //         content: {
  //           "application/json": {
  //             schema: {
  //               type: "object",
  //               properties: {
  //                 signedUrl: {
  //                   type: "string",
  //                   description: "Signed URL for uploading the file to S3.",
  //                 },
  //                 localUrl: {
  //                   type: "string",
  //                   description: "URL for uploading the file to local storage.",
  //                 },
  //               },
  //               example: {
  //                 signedUrl: "https://s3.example.com/upload/signature",
  //                 localUrl: "https://app.formbricks.com/uploads/example.jpg",
  //               },
  //             },
  //           },
  //         },
  //       },
  //       "400": {
  //         description: "Bad Request - One or more required fields are missing.",
  //         content: {
  //           "application/json": {
  //             schema: {
  //               type: "object",
  //               properties: {
  //                 error: {
  //                   type: "string",
  //                   description: "Detailed error message.",
  //                 },
  //               },
  //               example: {
  //                 error: "fileName is required",
  //               },
  //             },
  //           },
  //         },
  //       },
  //       "404": {
  //         description: "Not Found - The specified survey or organization does not exist.",
  //         content: {
  //           "application/json": {
  //             schema: {
  //               type: "object",
  //               properties: {
  //                 error: {
  //                   type: "string",
  //                   description: "Detailed error message.",
  //                 },
  //               },
  //               example: {
  //                 error: "Survey survey123 not found",
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //     servers: [
  //       {
  //         url: "https://app.formbricks.com/api/v2",
  //         description: "Formbricks API Server",
  //       },
  //     ],
  //   },
  // },
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
  console.log("Merged v1 client endpoints into the generated v2 documentation.");
} catch (error) {
  console.error("Error writing to OpenAPI file:", error);
  process.exit(1);
}
