import type { Response } from "@prisma/client";
import { z } from "zod";

export const ZResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  finished: z.boolean(),
  surveyId: z.string().cuid2(),
  contactId: z.string().nullable(),
  endingId: z.string().nullable(),
  data: z.record(z.union([z.string(), z.number(), z.array(z.string()), z.record(z.string())])),
  variables: z.record(z.union([z.string(), z.number()])),
  ttc: z.record(z.number()),
  meta: z.object({
    source: z.string().optional(),
    url: z.string().optional(),
    userAgent: z
      .object({
        browser: z.string().optional(),
        os: z.string().optional(),
        device: z.string().optional(),
      })
      .optional(),
    country: z.string().optional(),
    action: z.string().optional(),
  }),
  contactAttributes: z.record(z.string()).nullable(),
  singleUseId: z.string().nullable(),
  language: z.string().nullable(),
  displayId: z.string().nullable(),
}) satisfies z.ZodType<Response>;
