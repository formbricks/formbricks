import { CommunityCard } from "@/modules/communities/components/CommunityCard";
import { getWhitelistedUsersAction } from "@/modules/organization/settings/whitelist/actions";
// import { useTranslate } from "@tolgee/react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface CommunitiesProps {
  className?: string;
}

export const Communities = ({ className = "" }: CommunitiesProps) => {
  // const { t } = useTranslate();
  const [isFetchingCommunities, setIsFetchingCommunities] = useState(false);
  const [communities, setCommunities] = useState<TUserWhitelistInfo[]>([]);

  // Fetching whitelisted users
  const fetchCommunities = useCallback(async () => {
    setIsFetchingCommunities(true);
    const data = await getWhitelistedUsersAction({
      take: 10,
      skip: 0,
    });
    if (data && data.data) {
      setCommunities(data.data);
    } else {
      setCommunities([]);
    }
    setIsFetchingCommunities(false);
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  return (
    <div className={cn("relative flex w-full flex-col", className)}>
      {!isFetchingCommunities && communities && communities.length > 0 && (
        <div className="grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {communities.map((community) => {
            return <CommunityCard key={community.id} community={community} />;
          })}
        </div>
      )}
    </div>
  );
};
