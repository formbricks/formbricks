import { Invite } from "@prisma/client";

export interface InviteWithCreator extends Invite {
  creator: {
    name: string | null;
    email: string;
  };
}
