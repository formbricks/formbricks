import { getLongUrlFromShortUrl } from "@/../../packages/lib/services/shortUrl";
import { redirect } from "next/navigation";

const page = async ({ params }) => {
  try {
    const redirectUrl = await getLongUrlFromShortUrl(params.shortUrl);
    if (redirectUrl) return redirect(redirectUrl.longUrl);
  } catch (error) {
    return redirect("/404");
  }
};

export default page;
