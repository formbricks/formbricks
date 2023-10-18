import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
}

export const responseNoteCache = {
  tag: {},
  revalidate({}: RevalidateProps): void {},
};
