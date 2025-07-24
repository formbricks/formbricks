"use client";

import { useTranslate } from "@tolgee/react";
import { TActionClass } from "@formbricks/types/action-classes";

interface ActionClassInfoProps {
  actionClass: TActionClass;
  className?: string;
}

const InfoItem = ({ children }: { children: React.ReactNode }) => (
  <span className="mr-1 border-l border-slate-400 pl-1 first:border-l-0 first:pl-0">{children}</span>
);

export const ActionClassInfo = ({ actionClass, className = "" }: ActionClassInfoProps) => {
  const { t } = useTranslate();

  const renderUrlFilters = () => {
    const urlFilters = actionClass.noCodeConfig?.urlFilters;
    if (!urlFilters?.length) return null;

    return (
      <InfoItem>
        {t("environments.surveys.edit.url_filters")}:{" "}
        {urlFilters.map((urlFilter, index) => (
          <span key={urlFilter.rule + index}>
            {urlFilter.rule} <b>{urlFilter.value}</b>
            {index !== urlFilters.length - 1 && ", "}
          </span>
        ))}
      </InfoItem>
    );
  };

  const isNoCodeClick = actionClass.type === "noCode" && actionClass.noCodeConfig?.type === "click";

  const clickConfig = isNoCodeClick
    ? (actionClass.noCodeConfig as Extract<typeof actionClass.noCodeConfig, { type: "click" }>)
    : null;

  return (
    <div className={`mt-1 text-xs text-slate-500 ${className}`}>
      {actionClass.description && <span className="mr-1">{actionClass.description}</span>}

      {actionClass.type === "code" && (
        <InfoItem>
          {t("environments.surveys.edit.key")}: <b>{actionClass.key}</b>
        </InfoItem>
      )}

      {clickConfig?.elementSelector.cssSelector && (
        <InfoItem>
          {t("environments.surveys.edit.css_selector")}: <b>{clickConfig.elementSelector.cssSelector}</b>
        </InfoItem>
      )}

      {clickConfig?.elementSelector.innerHtml && (
        <InfoItem>
          {t("environments.surveys.edit.inner_text")}: <b>{clickConfig.elementSelector.innerHtml}</b>
        </InfoItem>
      )}

      {renderUrlFilters()}
    </div>
  );
};
