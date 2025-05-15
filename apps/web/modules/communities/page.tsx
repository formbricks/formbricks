import { CommunitiesClient } from "@/modules/communities/components/communities-client";
import { getTranslate } from "@/tolgee/server";

export const CommunitiesPage = async () => {
  const t = await getTranslate();
  // Fetch whitelisted users and display here
  // Create function to add a community to UserCommunity
  // Create function to remove a community from UserCommunity
  // Add links on community cards to /discover?community=id

  // href={`/environments/${environment.id}/discover`}
  // query={{ community: community.id }}
  // <Link href={query ? { pathname: href, query } : href} className="flex items-center">

  return <CommunitiesClient translatedTitle={t("common.communities")} />;
};
