import { getMetadataForLinkSurvey } from "@/app/s/[surveyId]/metadata";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getShortUrl } from "@formbricks/lib/shortUrl/service";
import { ZShortUrlId } from "@formbricks/types/shortUrl";

export async function generateMetadata({ params }): Promise<Metadata> {
  if (!params.shortUrlId) {
    notFound();
  }

  if (ZShortUrlId.safeParse(params.shortUrlId).success !== true) {
    notFound();
  }

  let shortUrl;

  try {
    shortUrl = await getShortUrl(params.shortUrlId);
    if (!shortUrl) {
      notFound();
    }
  } catch (error) {
    console.error(error);
  }

  const surveyId = shortUrl.url.substring(shortUrl.url.lastIndexOf("/") + 1);
  return getMetadataForLinkSurvey(surveyId);
}
export default async function ShortUrlPage({ params }) {
  if (!params.shortUrlId) {
    notFound();
  }

  if (ZShortUrlId.safeParse(params.shortUrlId).success !== true) {
    // return not found if unable to parse short url id
    notFound();
  }

  let shortUrl;

  try {
    shortUrl = await getShortUrl(params.shortUrlId);
  } catch (error) {
    console.error(error);
  }

  if (shortUrl) {
    redirect(shortUrl.url);
  }

  // return not found if short url not found
  notFound();
}
