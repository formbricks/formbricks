import { redirect } from "next/navigation";
import { getRedirectUrl } from "@formbricks/lib/services/shortenedUrl";
export default async function page({ params }) {
  const redirectUrl = await getRedirectUrl(params.shortUrl);
  console.log(redirectUrl);
  if (redirectUrl) {
    return redirect(redirectUrl.longUrl);
  } else {
    return redirect("/404");
  }
}
