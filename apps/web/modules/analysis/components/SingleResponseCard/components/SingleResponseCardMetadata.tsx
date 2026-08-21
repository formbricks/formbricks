"use client";

import { LanguagesIcon, LucideIcon, MonitorIcon, SmartphoneIcon, Tag } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import {
  RESERVED_FIELD_CATALOG,
  listDisplayableReservedFields,
} from "@formbricks/types/embedded-data-resolver";
import { TResponse } from "@formbricks/types/responses";
import { TUserLocale } from "@formbricks/types/user";
import { getReservedFieldLabel } from "@/modules/analysis/lib/reserved-field-display";
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
          <Button type="button" variant="outline" size="icon" aria-label={ariaLabel}>
            <Icon className="size-4" />
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
  /**
   * The seven fields this button has always shown, read from the catalog rather than written out as
   * seven JSX branches (ENG-2540). Absent values are omitted by
   * {@link listDisplayableReservedFields}, so a response that carries none of them renders nothing —
   * which is what makes a pre-ENG-1841 response look exactly as it did before.
   */
  const primaryFields = listDisplayableReservedFields(RESERVED_FIELD_CATALOG, response, "primary");
  const hasLanguage = response.language && response.language !== "default";

  if (!hasContactAttributes && primaryFields.length === 0 && !hasLanguage) {
    return null;
  }

  /**
   * The button's own icon. Reads `meta.userAgent.device` directly rather than through the catalog
   * because it is choosing an icon for the *group*, not rendering the field.
   */
  const userAgentDeviceIcon = (() => {
    const device = response.meta.userAgent?.device?.toLowerCase();
    if (!device) return MonitorIcon;
    return device.includes("mobile") || device.includes("phone") ? SmartphoneIcon : MonitorIcon;
  })();

  const contactAttributesTooltipContent = hasContactAttributes ? (
    <div>
      {response.singleUseId && (
        <div className="mb-2">
          <p className="py-1 font-semibold text-slate-700">
            {t("workspace.surveys.responses.single_use_id")}
          </p>
          <span>{response.singleUseId}</span>
        </div>
      )}
      <p className="py-1 font-semibold text-slate-700">
        {t("workspace.surveys.responses.person_attributes")}
      </p>
      {Object.keys(response.contactAttributes || {}).map((key) => (
        <p key={key} className="truncate" title={`${key}: ${response.contactAttributes?.[key]}`}>
          {key}: {response.contactAttributes?.[key]}
        </p>
      ))}
    </div>
  ) : null;

  /**
   * Previously the whole block was gated on `hasUserAgent`, so with "Anonymize responses" on — which
   * drops `meta.userAgent` wholesale — `url`, `action` and `source` disappeared with it even though
   * they were still captured. Gating per field is what this loop does by construction.
   */
  const primaryTooltipContent =
    primaryFields.length > 0 ? (
      <div className="text-slate-600">
        <p className="py-1 font-semibold text-slate-700">{t("workspace.surveys.responses.device_info")}</p>
        {primaryFields.map(({ entry, value }) => (
          <p
            key={entry.name}
            // `url` is the one value long enough to need wrapping rather than truncation.
            className={entry.name === "url" ? "break-all" : "truncate"}
            title={`${getReservedFieldLabel(entry.name, t)}: ${value}`}>
            {getReservedFieldLabel(entry.name, t)}: {value}
          </p>
        ))}
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
    <div className="flex items-center gap-x-2">
      {hasContactAttributes && contactAttributesTooltipContent && (
        <InfoIconButton
          icon={Tag}
          tooltipContent={contactAttributesTooltipContent}
          ariaLabel={t("workspace.surveys.responses.person_attributes")}
        />
      )}
      {primaryTooltipContent && (
        <InfoIconButton
          icon={userAgentDeviceIcon}
          tooltipContent={primaryTooltipContent}
          ariaLabel={t("workspace.surveys.responses.device_info")}
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
