import { Contact, Response, ResponseNote, Tag, User } from "@prisma/client";
import { z } from "zod";

export type TResponseNew = Response & {
  contact?: Pick<Contact, "id" | "userId">;
  notes?: (Pick<ResponseNote, "id" | "text" | "createdAt" | "updatedAt" | "isEdited" | "isResolved"> & {
    user: Pick<User, "id" | "name">;
  })[];
  tags: Tag[];
};

export const ZGetResponsesFilter = z.object({
  surveyId: z.string().cuid2().optional(),
  limit: z.coerce.number().default(10).optional(),
  skip: z.coerce.number().default(0).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt").optional(),
  order: z.enum(["asc", "desc"]).default("asc").optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type TGetResponsesFilter = z.infer<typeof ZGetResponsesFilter>;
