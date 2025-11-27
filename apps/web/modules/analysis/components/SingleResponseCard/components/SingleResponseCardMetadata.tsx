"use client";

import { LanguagesIcon, LucideIcon, MonitorIcon, SmartphoneIcon, Tag } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TResponse } from "@formbricks/types/responses";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@/modules/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface InfoIconButtonProps {
  icon: LucideIcon;
  tooltipContent: ReactNode;
  ariaLabel: string;
  maxWidth?: string;
}

const InfoIconButton = ({
  icon: Icon,
  tooltipContent,
  ariaLabel,
  maxWidth = "max-w-[75vw]",
}: InfoIconButtonProps) => {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label={ariaLabel}>
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent avoidCollisions align="start" side="bottom" className={maxWidth}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface SingleResponseCardMetadataProps {
  response: TResponse;
  locale: TUserLocale;
}

export const SingleResponseCardMetadata = ({ response, locale }: SingleResponseCardMetadataProps) => {
  const { t } = useTranslation();

  const hasContactAttributes =
    response.contactAttributes && Object.keys(response.contactAttributes).length > 0;
  const hasUserAgent = response.meta.userAgent && Object.keys(response.meta.userAgent).length > 0;
  const hasLanguage = response.language && response.language !== "default";

  if (!hasContactAttributes && !hasUserAgent && !hasLanguage) {
    return null;
  }

  const userAgentDeviceIcon = (() => {
    if (!hasUserAgent || !response.meta.userAgent?.device) return MonitorIcon;
    const device = response.meta.userAgent.device.toLowerCase();
    return device.includes("mobile") || device.includes("phone") ? SmartphoneIcon : MonitorIcon;
  })();

  const contactAttributesTooltipContent = hasContactAttributes ? (
    <div>
      {response.singleUseId && (
        <div className="mb-2">
          <p className="py-1 font-semibold text-slate-700">
            {t("environments.surveys.responses.single_use_id")}
          </p>
          <span>{response.singleUseId}</span>
        </div>
      )}
      <p className="py-1 font-semibold text-slate-700">
        {t("environments.surveys.responses.person_attributes")}
      </p>
      {Object.keys(response.contactAttributes || {}).map((key) => (
        <p key={key} className="truncate" title={`${key}: ${response.contactAttributes?.[key]}`}>
          {key}: {response.contactAttributes?.[key]}
        </p>
      ))}
    </div>
  ) : null;

  const userAgentTooltipContent = hasUserAgent ? (
    <div className="text-slate-600">
      <p className="py-1 font-semibold text-slate-700">{t("environments.surveys.responses.device_info")}</p>
      {response.meta.userAgent?.browser && (
        <p className="truncate" title={`Browser: ${response.meta.userAgent.browser}`}>
          {t("environments.surveys.responses.browser")}: {response.meta.userAgent.browser}
        </p>
      )}
      {response.meta.userAgent?.os && (
        <p className="truncate" title={`OS: ${response.meta.userAgent.os}`}>
          {t("environments.surveys.responses.os")}: {response.meta.userAgent.os}
        </p>
      )}
      {response.meta.userAgent && (
        <p
          className="truncate"
          title={`Device: ${response.meta.userAgent.device ? response.meta.userAgent.device : "PC / Generic device"}`}>
          {t("environments.surveys.responses.device")}:{" "}
          {response.meta.userAgent.device ? response.meta.userAgent.device : "PC / Generic device"}
        </p>
      )}
      {response.meta.url && (
        <p className="break-all" title={`URL: ${response.meta.url}`}>
          {t("common.url")}: {response.meta.url}
        </p>
      )}
      {response.meta.action && (
        <p className="truncate" title={`Action: ${response.meta.action}`}>
          {t("common.action")}: {response.meta.action}
        </p>
      )}
      {response.meta.source && (
        <p className="truncate" title={`Source: ${response.meta.source}`}>
          {t("environments.surveys.responses.source")}: {response.meta.source}
        </p>
      )}
      {response.meta.country && (
        <p className="truncate" title={`Country: ${response.meta.country}`}>
          {t("environments.surveys.responses.country")}: {response.meta.country}
        </p>
      )}
    </div>
  ) : null;

  const languageTooltipContent =
    hasLanguage && response.language ? (
      <div>
        <p className="font-semibold text-slate-700">{t("common.language")}</p>
        <p>{getLanguageLabel(response.language, locale)}</p>
      </div>
    ) : null;

  return (
    <div className="flex items-center space-x-2">
      {hasContactAttributes && contactAttributesTooltipContent && (
        <InfoIconButton
          icon={Tag}
          tooltipContent={contactAttributesTooltipContent}
          ariaLabel={t("environments.surveys.responses.person_attributes")}
        />
      )}
      {hasUserAgent && userAgentTooltipContent && (
        <InfoIconButton
          icon={userAgentDeviceIcon}
          tooltipContent={userAgentTooltipContent}
          ariaLabel={t("environments.surveys.responses.device_info")}
          maxWidth="max-w-md"
        />
      )}
      {hasLanguage && languageTooltipContent && (
        <InfoIconButton
          icon={LanguagesIcon}
          tooltipContent={languageTooltipContent}
          ariaLabel={t("common.language")}
        />
      )}
    </div>
  );
};
