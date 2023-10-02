import { redirect } from "next/navigation";
import { getFullUrl } from "@formbricks/lib/services/urlshortener";

export default async function ShortUrlPage({ params, searchParams }) {
  console.log({ params, searchParams });
  const fullUrl = await getFullUrl(params.shortUrl);

  if (!fullUrl) redirect("/");
  if (fullUrl) redirect(fullUrl);

  return null;
}
