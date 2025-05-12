import { DiscoverClient } from "@/modules/discover/components/discover-client";
import { getTranslate } from "@/tolgee/server";

interface DiscoverPageProps {
  searchParams: Promise<{
    community: string;
  }>;
}

export const DiscoverPage = async (props: DiscoverPageProps) => {
  const t = await getTranslate();
  const searchParams = await props.searchParams;

  return <DiscoverClient communityId={searchParams.community} translatedTitle={t("common.discover")} />;
};

export default DiscoverPage;
