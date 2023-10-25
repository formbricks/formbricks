import { revalidateTag } from "next/cache";

interface RevalidateProps {
  fileKey: string;
}

export const storageCache = {
  tag: {
    byFilekey(filekey: string): string {
      return `storage-filekey-${filekey}`;
    },
  },
  revalidate({ fileKey }: RevalidateProps): void {
    revalidateTag(this.tag.byFilekey(fileKey));
  },
};
