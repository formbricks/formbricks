import RewardIcon from "@/images/reward.svg";
import { ChainContext } from "@/modules/discover/context/chain-context";
import { TExtendedSurvey } from "@/modules/discover/types/survey";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { formatDistance } from "date-fns";
import { ArrowRightIcon, UsersIcon } from "lucide-react";
import { Clock } from "lucide-react";
import Image from "next/image";
import { useContext, useEffect, useState } from "react";

interface AvailableSurveyCardProps {
  survey: TExtendedSurvey;
  type: String;
}

export const AvailableSurveyCard = ({ survey }: AvailableSurveyCardProps) => {
  const { t } = useTranslate();
  const surveyTypeLabel = t("common.engagement");
  const chains = useContext(ChainContext);
  const [chainName, setChainName] = useState<string | null>(null);

  useEffect(() => {
    if (chains && survey.reward?.chainId) {
      const chain = chains.find((chain) => chain.chainId === survey.reward?.chainId);
      if (chain) setChainName(chain.name);
    }
  }, [chains, survey.reward?.chainId]);

  return (
    <div className="relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[200px] flex-col justify-between p-6 pb-3">
        <div className="mb-2 flex w-full flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge size="tiny" type="gray" text={surveyTypeLabel} />
          </div>

          <div className="flex items-center gap-1 text-slate-700">
            {survey.responseCount != undefined && (
              <div className="flex items-center py-0.5 text-xs">
                <UsersIcon className="mr-1 h-4 w-4" strokeWidth={3} />
                <div className="flex items-center gap-1">
                  <span>{survey.responseCount}</span>
                  <span>
                    {survey.responseCount <= 1 ? t("common.participant") : t("common.participants")}
                  </span>
                </div>
              </div>
            )}
            <span className="mx-1 -mt-1">|</span>

            {survey.closeOnDate && (
              <div className="flex items-center text-xs">
                <Clock className="mr-1 h-4 w-4" strokeWidth={1.5} />
                {formatDistance(new Date(survey.closeOnDate), new Date(), { addSuffix: false })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          <p className="mb-1 line-clamp-1 text-lg font-medium">{survey.name}</p>
          <p className="mb-4 line-clamp-2 text-sm text-slate-500">{survey.description}</p>
        </div>

        {chainName && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md bg-purple-100 px-1.5 py-1">
                <Image src={RewardIcon as string} className="h-5 w-5" alt="reward icon" />
                <div className="text-sm text-slate-600">
                  <span className="mr-1 font-medium">Reward:</span>
                  <span className="font-bold">
                    {survey.reward?.amount} {survey.reward?.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* <div className="flex items-center gap-2">
              <span className="relative mr-1 flex h-5 w-5 shrink-0 overflow-hidden rounded-md">
                <div className="mx-auto w-80 bg-slate-500" />
              </span>
              <span className="text-xs text-slate-500">{chainName}</span>
            </div> */}
          </div>
        )}
      </div>

      <div className="p-6 pt-0">
        {survey.creator && (
          <div className="mb-4 flex items-center">
            {survey.creator.imageUrl ? (
              <img
                src={survey.creator.imageUrl}
                alt={t("")}
                className="mr-2 h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium"></div>
            )}
            <span className="text-xs text-slate-500">
              {t("common.created_by")}{" "}
              <span className="font-medium text-slate-600">{survey.creator.name} </span>
            </span>
          </div>
        )}
        <div className="flex items-center">
          <Button
            onClick={() => (window.location.href = `/s/${survey.id}`)}
            className="ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            type="submit"
            loading={false}>
            {t("environments.activity.card.start_engagement")}
            <ArrowRightIcon
              className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              strokeWidth={3}
            />
          </Button>
        </div>
      </div>
    </div>
  );
};
