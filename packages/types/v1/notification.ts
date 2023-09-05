import z from "zod";

export const ZNotification = z.object({
  id: z.string().cuid2(),
  userId: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.string(),
  read: z.boolean(),
  data: z.object({
    title: z.string(),
    body: z.string(),
  }),
});

export type TNotification = z.infer<typeof ZNotification>;
