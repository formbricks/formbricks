import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getShortUrl } from "@formbricks/lib/shortUrl/service";
import { getSurvey } from "@formbricks/lib/survey/service";
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
  } catch (error) {
    console.error(error);
  }

  if (shortUrl) {
    const surveyId = shortUrl.url.substring(shortUrl.url.lastIndexOf("/") + 1);
    const survey = await getSurvey(surveyId);

    if (!survey || survey.type !== "link" || survey.status === "draft") {
      notFound();
    }

    const product = await getProductByEnvironmentId(survey.environmentId);

    if (!product) {
      throw new Error("Product not found");
    }

    function getNameForURL(string) {
      return string.replace(/ /g, "%20");
    }

    function getBrandColorForURL(string) {
      return string.replace(/#/g, "%23");
    }

    const brandColor = getBrandColorForURL(product.brandColor);
    const surveyName = getNameForURL(survey.name);

    const ogImgURL = `/api/v1/og?brandColor=${brandColor}&name=${surveyName}`;

    return {
      title: survey.name,
      metadataBase: new URL(WEBAPP_URL),
      openGraph: {
        title: survey.name,
        description: "Create your own survey like this with Formbricks' open source survey suite.",
        url: `/s/${survey.id}`,
        siteName: "",
        images: [ogImgURL],
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: survey.name,
        description: "Create your own survey like this with Formbricks' open source survey suite.",
        images: [ogImgURL],
      },
    };
  } else {
    notFound();
  }
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
