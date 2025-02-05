import { Contact, Response, ResponseNote, Tag, User } from "@prisma/client";

export type TResponseDelete = Response & {
  contact?: Pick<Contact, "id" | "userId">;
  notes?: (Pick<ResponseNote, "id" | "text" | "createdAt" | "updatedAt" | "isEdited" | "isResolved"> & {
    user: Pick<User, "id" | "name">;
  })[];
  tags: Tag[];
};
