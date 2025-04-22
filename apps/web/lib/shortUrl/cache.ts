import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  url?: string;
}

export const shortUrlCache = {
  tag: {
    byId(id: string) {
      return `shortUrls-${id}`;
    },
    byUrl(url: string) {
      return `shortUrls-byUrl-${url}`;
    },
  },
  revalidate({ id, url }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (url) {
      revalidateTag(this.tag.byUrl(url));
    }
  },
};
