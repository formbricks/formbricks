import { DiscoverClient } from "@/modules/discover/components/discover-client";
import { getTranslate } from "@/tolgee/server";

export const DiscoverPage = async () => {
  const t = await getTranslate();

  return <DiscoverClient translatedTitle={t("common.discover")} />;
};

export default DiscoverPage;
