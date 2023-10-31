import z from "zod";

export const ZSession = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
  personId: z.string().cuid2(),
});

export type TSession = z.infer<typeof ZSession>;

export const ZSessionWithActions = z.object({
  id: z.string().cuid2(),
  events: z.array(
    z.object({
      id: z.string().cuid2(),
      createdAt: z.date(),
      eventClass: z
        .object({
          name: z.string(),
          description: z.union([z.string(), z.null()]),
          type: z.enum(["code", "noCode", "automatic"]),
        })
        .nullable(),
    })
  ),
});

export type TSessionWithActions = z.infer<typeof ZSessionWithActions>;
