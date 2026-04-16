import type { Response } from "@prisma/client";
import { z } from "zod";

export const ZResponse = z.object({
  id: z.cuid2().describe("The ID of the response"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the response was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the response was last updated"),
  finished: z
    .boolean()
    .meta({
      example: true,
    })
    .describe("Whether the response is finished"),
  surveyId: z.cuid2().describe("The ID of the survey"),
  contactId: z.cuid2().nullable().describe("The ID of the contact"),
  endingId: z.cuid2().nullable().describe("The ID of the ending"),
  data: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.array(z.string()), z.record(z.string(), z.string())])
    )
    .meta({
      example: {
        question1: "answer1",
        question2: 2,
        question3: ["answer3", "answer4"],
        question4: {
          subquestion1: "answer5",
        },
      },
    })
    .describe("The data of the response"),
  variables: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .meta({
      example: {
        variable1: "answer1",
        variable2: 2,
      },
    })
    .describe("The variables of the response"),
  ttc: z
    .record(z.string(), z.number())
    .meta({
      example: {
        question1: 10,
        question2: 20,
      },
    })
    .describe("The TTC of the response"),
  meta: z
    .object({
      source: z
        .string()
        .optional()
        .meta({
          example: "https://example.com",
        })
        .describe("The source of the response"),
      url: z
        .string()
        .optional()
        .meta({
          example: "https://example.com",
        })
        .describe("The URL of the response"),
      userAgent: z
        .object({
          browser: z.string().optional(),
          os: z.string().optional(),
          device: z.string().optional(),
        })
        .optional(),
      country: z.string().optional(),
      action: z.string().optional(),
    })
    .meta({
      example: {
        source: "https://example.com",
        url: "https://example.com",
        userAgent: {
          browser: "Chrome",
          os: "Windows",
          device: "Desktop",
        },
        country: "US",
        action: "click",
      },
    })
    .describe("The meta data of the response"),
  contactAttributes: z
    .record(z.string(), z.string())
    .nullable()
    .meta({
      example: {
        attribute1: "value1",
        attribute2: "value2",
      },
    })
    .describe("The attributes of the contact"),
  singleUseId: z.string().nullable().describe("The single use ID of the response"),
  language: z
    .string()
    .nullable()
    .meta({
      example: "en",
    })
    .describe("The language of the response"),
  displayId: z.string().nullable().describe("The display ID of the response"),
}) satisfies z.ZodType<Response>;

ZResponse.meta({
  id: "response",
}).describe("A response");
