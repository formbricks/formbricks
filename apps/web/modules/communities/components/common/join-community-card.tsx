import CommmunityPlaceholderOne from "@/images/community-placeholder-1.png";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface JoinCommunityCardProps {
  creator: TUserWhitelistInfo;
  className?: string;
}

export const JoinCommunityCard = ({ creator, className = "" }: JoinCommunityCardProps) => {
  const { t } = useTranslate();

  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-black shadow-sm",
        className
      )}>
      <div className="flex min-h-[200px] flex-row gap-3 p-4">
        <div className="flex h-full flex-col">
          <Image src={CommmunityPlaceholderOne} alt="Community Placeholder Image" />
        </div>
        <div className="flex h-full flex-col">
          {creator.name || creator.email}
          <div className="space-y-2">
            <Button
              aria-label={t("common.join")}
              onClick={() => window.open("https://app.engagehq.xyz/s/cm9sr6au60006t9010yzp17m7", "_blank")}
              className={cn(
                "ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-xs transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:text-sm",
                className
              )}>
              {t("common.join")}
              <ArrowRightIcon
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1 md:ml-2 md:h-4 md:w-4"
                strokeWidth={3}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
