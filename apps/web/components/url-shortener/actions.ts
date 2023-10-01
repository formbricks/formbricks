"use server";

import { createShortUrl, getFullUrl } from "@formbricks/lib/services/urlshortener";

export const createShortUrlAction = async (fullUrl: string) => {
  return await createShortUrl(fullUrl);
};

export const getFullUrlAction = async (shortUrl: string) => {
  return await getFullUrl(shortUrl);
};
