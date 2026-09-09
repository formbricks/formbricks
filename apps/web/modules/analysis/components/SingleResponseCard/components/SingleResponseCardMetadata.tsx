"use client";

import { LanguagesIcon, LucideIcon, MonitorIcon, SmartphoneIcon, Tag } from "lucide-react";
import { Fragment, ReactNode, useId } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface InfoPopoverButtonProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

/**
 * An icon button that opens a popover — not a tooltip. A hover tooltip cannot be reached from a
 * keyboard or a touch screen, closes as soon as the pointer moves to select a value, and clips
 * anything longer than a line or two. A click-to-open dialog fixes all three, which matters now that
 * the metadata popover carries up to twenty-one rows (see {@link SingleResponseCardMetadata}).
 */
const InfoPopoverButton = ({ icon: Icon, title, children }: Readonly<InfoPopoverButtonProps>) => {
  const headingId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={title}>
          <Icon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        aria-labelledby={headingId}
        className="max-h-[70vh] w-auto max-w-[min(28rem,90vw)] overflow-y-auto">
        <h4 id={headingId} className="mb-3 text-sm font-semibold text-slate-700">
          {title}
        </h4>
        {children}
      </PopoverContent>
    </Popover>
  );
};

interface KeyValueListProps {
  items: { key: string; label: string; value: string }[];
}

/**
 * Key:value pairs as a definition list. `<dl>` is the element assistive tech announces as
 * "term, definition" pairs — a `<p>` per row reading `{label}: {value}` is one undifferentiated
 * string. Two columns keep every label in one scan line and every value aligned, and values wrap
 * instead of truncating so a long URL or referrer is readable in full without a `title` hover.
 */
const KeyValueList = ({ items }: Readonly<KeyValueListProps>) => (
  <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
    {items.map(({ key, label, value }) => (
      <Fragment key={key}>
        <dt className="text-slate-500">{label}</dt>
        <dd className="ph-no-capture min-w-0 font-medium wrap-anywhere text-slate-700">{value}</dd>
      </Fragment>
    ))}
  </dl>
);

interface SingleResponseCardMetadataProps {
  response: TResponse;
  locale: TUserLocale;
}

export const SingleResponseCardMetadata = ({
  response,
  locale,
}: Readonly<SingleResponseCardMetadataProps>) => {
  const { t } = useTranslation();

  const hasContactAttributes =
    response.contactAttributes && Object.keys(response.contactAttributes).length > 0;
  /**
   * Every auto-captured field the response carries, read from the catalog rather than written out as
   * JSX branches (ENG-2540). The seven `primary` fields the card has always shown come first, then
   * the `secondary` ones ENG-1841 added (page, referrer, UTM params, screen, timezone, IP) — one
   * popover instead of a tooltip plus a "More context" fold in the card body. Absent values are
   * omitted by {@link listDisplayableReservedFields}, so a response that carries none of them renders
   * nothing — which is what makes a pre-ENG-1841 response look exactly as it did before.
   */
  const primaryFields = listDisplayableReservedFields(RESERVED_FIELD_CATALOG, response, "primary");
  const secondaryFields = listDisplayableReservedFields(RESERVED_FIELD_CATALOG, response, "secondary");
  const hasMetadata = primaryFields.length > 0 || secondaryFields.length > 0;
  const hasLanguage = response.language && response.language !== "default";

  if (!hasContactAttributes && !hasMetadata && !hasLanguage) {
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

  const toItems = (fields: typeof primaryFields) =>
    fields.map(({ entry, value }) => ({
      key: entry.name,
      label: getReservedFieldLabel(entry.name, t),
      value,
    }));

  return (
    <div className="flex items-center gap-x-2">
      {hasContactAttributes && (
        <InfoPopoverButton icon={Tag} title={t("workspace.surveys.responses.person_attributes")}>
          {response.singleUseId && (
            <KeyValueList
              items={[
                {
                  key: "singleUseId",
                  label: t("workspace.surveys.responses.single_use_id"),
                  value: response.singleUseId,
                },
              ]}
            />
          )}
          {response.singleUseId && <hr className="my-3 border-slate-200" />}
          <KeyValueList
            items={Object.entries(response.contactAttributes ?? {}).map(([key, value]) => ({
              key,
              label: key,
              value: String(value),
            }))}
          />
        </InfoPopoverButton>
      )}
      {hasMetadata && (
        // Previously the whole block was gated on `hasUserAgent`, so with "Anonymize responses" on —
        // which drops `meta.userAgent` wholesale — `url`, `action` and `source` disappeared with it
        // even though they were still captured. Gating per field is what the catalog read does by
        // construction.
        <InfoPopoverButton icon={userAgentDeviceIcon} title={t("common.metadata")}>
          {primaryFields.length > 0 && <KeyValueList items={toItems(primaryFields)} />}
          {primaryFields.length > 0 && secondaryFields.length > 0 && <hr className="my-3 border-slate-200" />}
          {secondaryFields.length > 0 && <KeyValueList items={toItems(secondaryFields)} />}
        </InfoPopoverButton>
      )}
      {hasLanguage && response.language && (
        <InfoPopoverButton icon={LanguagesIcon} title={t("workspace.surveys.responses.survey_language")}>
          <p className="text-sm font-medium text-slate-700">{getLanguageLabel(response.language, locale)}</p>
        </InfoPopoverButton>
      )}
    </div>
  );
};
