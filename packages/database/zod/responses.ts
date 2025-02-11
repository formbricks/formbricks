import type { Response } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZResponse = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the response",
  }),
  createdAt: z.coerce.date().openapi({
    description: "The date and time the response was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the response was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  finished: z.boolean().openapi({
    description: "Whether the response is finished",
    example: true,
  }),
  surveyId: z.string().cuid2().openapi({
    description: "The ID of the survey",
  }),
  contactId: z.string().cuid2().nullable().openapi({
    description: "The ID of the contact",
  }),
  endingId: z.string().cuid2().nullable().openapi({
    description: "The ID of the ending",
  }),
  data: z.record(z.union([z.string(), z.number(), z.array(z.string()), z.record(z.string())])).openapi({
    description: "The data of the response",
    example: {
      question1: "answer1",
      question2: 2,
      question3: ["answer3", "answer4"],
      question4: {
        subquestion1: "answer5",
      },
    },
  }),
  variables: z.record(z.union([z.string(), z.number()])).openapi({
    description: "The variables of the response",
    example: {
      variable1: "answer1",
      variable2: 2,
    },
  }),
  ttc: z.record(z.number()).openapi({
    description: "The TTC of the response",
    example: {
      question1: 10,
      question2: 20,
    },
  }),
  meta: z
    .object({
      source: z.string().optional().openapi({
        description: "The source of the response",
        example: "https://example.com",
      }),
      url: z.string().optional().openapi({
        description: "The URL of the response",
        example: "https://example.com",
      }),
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
    .openapi({
      description: "The meta data of the response",
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
    }),
  contactAttributes: z
    .record(z.string())
    .nullable()
    .openapi({
      description: "The attributes of the contact",
      example: {
        attribute1: "value1",
        attribute2: "value2",
      },
    }),
  singleUseId: z.string().nullable().openapi({
    description: "The single use ID of the response",
  }),
  language: z.string().nullable().openapi({
    description: "The language of the response",
    example: "en",
  }),
  displayId: z.string().nullable().openapi({
    description: "The display ID of the response",
  }),
}) satisfies z.ZodType<Response>;

ZResponse.openapi({
  ref: "response",
  description: "A response",
});
