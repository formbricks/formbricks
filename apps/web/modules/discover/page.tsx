import coinsImg from "@/images/illustrations/coins.png";
import { DiscoverClient } from "@/modules/discover/components/discover-client";
import { getTranslate } from "@/tolgee/server";
import { cn } from "@formbricks/lib/cn";

interface DiscoverPageProps {
  searchParams: Promise<{
    community: string;
  }>;
}

export const DiscoverPage = async (props: DiscoverPageProps) => {
  const t = await getTranslate();
  const searchParams = await props.searchParams;

  return (
    <DiscoverClient
      communityId={searchParams.community}
      translatedTitle={
        <h1 className={cn("text-5xl font-bold capitalize text-slate-800")}>
          {t("common.engage_more")},{" "}
          <span
            // From tailwind.config - backgroundImage.text-gradient
            className="bg-text-gradient bg-clip-text text-transparent">
            {t("common.earn_more")}
          </span>
        </h1>
      }
      translatedSubTitle={t("common.discover_banner_description")}
      bannerImage={coinsImg}
    />
  );
};

export default DiscoverPage;
