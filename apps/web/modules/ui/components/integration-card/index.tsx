"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "@/modules/ui/components/button";

interface CardProps {
  connectText?: string;
  connectHref?: string;
  connectNewTab?: boolean;
  docsText?: string;
  docsHref?: string;
  docsNewTab?: boolean;
  label: string;
  description: string;
  icon?: React.ReactNode;
  connected?: boolean;
  statusText?: string;
  /**
   * Gates the connect/manage action only. The docs link stays live: it points at public
   * documentation, so reading it is not a permission a read-only member can lack.
   */
  disabled?: boolean;
}

export type { CardProps };

interface CardActionProps {
  href: string;
  text?: string;
  newTab?: boolean;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
}

/**
 * A disabled button cannot hold a link: `disabled` only suppresses clicks queued on the button
 * itself, so a nested `<a href>` stays clickable and still navigates. The button read as greyed out
 * while a read-only member was sent to the integration page anyway. So render no link at all when
 * disabled — there is then nothing left to click.
 *
 * The enabled branch keeps the link nested inside the button rather than collapsing the two with
 * `asChild`. That looks like the tidier shape, but the button's hover styles are `enabled:hover:*`
 * variants, which compile to the `:enabled` pseudo-class — and `:enabled` only ever matches form
 * controls, never an `<a>`. Hoisting the Link into the button's place would therefore drop the
 * hover state on every enabled card.
 */
const CardAction = ({ href, text, newTab, disabled, variant }: Readonly<CardActionProps>) =>
  disabled ? (
    <Button disabled size="sm" variant={variant}>
      {text}
    </Button>
  ) : (
    <Button size="sm" variant={variant}>
      <Link href={href} target={newTab ? "_blank" : "_self"}>
        {text}
      </Link>
    </Button>
  );

export const Card: React.FC<CardProps> = ({
  connectText,
  connectHref,
  connectNewTab,
  docsText,
  docsHref,
  docsNewTab,
  label,
  description,
  icon,
  connected,
  statusText,
  disabled,
}) => (
  <div className="relative rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs">
    {connected != undefined && statusText != undefined && (
      <div className="absolute top-4 right-4 flex items-center rounded-sm bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {connected === true ? (
          <span className="relative mr-1 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-green-500"></span>
          </span>
        ) : (
          <span className="relative mr-1 flex size-2">
            <span className="relative inline-flex size-2 rounded-full bg-slate-400"></span>
          </span>
        )}
        {statusText}
      </div>
    )}

    {icon && <div className="mb-6 size-8">{icon}</div>}
    <h3 className="text-lg font-bold text-slate-800">{label}</h3>
    <p className="text-xs text-slate-500">{description}</p>
    <div className="mt-4 flex gap-x-2">
      {connectHref && (
        <CardAction href={connectHref} text={connectText} newTab={connectNewTab} disabled={disabled} />
      )}
      {docsHref && <CardAction href={docsHref} text={docsText} newTab={docsNewTab} variant="secondary" />}
    </div>
  </div>
);
