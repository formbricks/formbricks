import { getMetadataForLinkSurvey } from "@/modules/survey/link/metadata";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getShortUrl } from "@formbricks/lib/shortUrl/service";
import { TShortUrl, ZShortUrlId } from "@formbricks/types/short-url";

export const generateMetadata = async (props): Promise<Metadata> => {
  const params = await props.params;
  if (!params.shortUrlId) {
    notFound();
  }

  if (ZShortUrlId.safeParse(params.shortUrlId).success !== true) {
    notFound();
  }

  try {
    const shortUrl = await getShortUrl(params.shortUrlId);

    if (!shortUrl) {
      notFound();
    }

    const surveyId = shortUrl.url.substring(shortUrl.url.lastIndexOf("/") + 1);
    return getMetadataForLinkSurvey(surveyId);
  } catch (error) {
    notFound();
  }
};

const Page = async (props) => {
  const params = await props.params;
  if (!params.shortUrlId) {
    notFound();
  }

  if (ZShortUrlId.safeParse(params.shortUrlId).success !== true) {
    // return not found if unable to parse short url id
    notFound();
  }

  let shortUrl: TShortUrl | null = null;

  try {
    shortUrl = await getShortUrl(params.shortUrlId);
  } catch (error) {
    console.error(error);
    notFound();
  }

  if (shortUrl) {
    redirect(shortUrl.url);
  }

  notFound();
};

export default Page;
