import { redirect } from "next/navigation";
import { getRedirectUrl } from "@formbricks/lib/services/shortenedUrl";
export default async function page({ params }) {
  const redirectUrl = await getRedirectUrl(params.id);
  if (redirectUrl) {
    return redirect(redirectUrl.longUrl);
  } else {
    return {
      notFound: true,
    };
  }
}
