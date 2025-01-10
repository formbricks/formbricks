"use client";

import { useInView } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSectionStore } from "@/components/section-provider";
import { Tag } from "@/components/tag";
import { remToPx } from "@/lib/rem-to-px";

function AnchorIcon(props: React.ComponentPropsWithoutRef<"svg">): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="none" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="m6.5 11.5-.964-.964a3.535 3.535 0 1 1 5-5l.964.964m2 2 .964.964a3.536 3.536 0 0 1-5 5L8.5 13.5m0-5 3 3" />
    </svg>
  );
}

function Eyebrow({ tag, label }: { tag?: string; label?: string }): React.JSX.Element | null {
  if (!tag && !label) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-3">
      {tag ? <Tag>{tag}</Tag> : null}
      {tag && label ? <span className="h-0.5 w-0.5 rounded-full bg-zinc-300 dark:bg-zinc-600" /> : null}
      {label ? <span className="font-mono text-xs text-zinc-400">{label}</span> : null}
    </div>
  );
}

function Anchor({ id, inView, children }: { id: string; inView: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <Link href={`#${id}`} className="group text-inherit no-underline hover:text-inherit">
      {inView ? <div className="absolute ml-[calc(-1*var(--width))] mt-1 hidden w-[var(--width)] opacity-0 transition [--width:calc(1.35rem+0.85px+38%-min(38%,calc(theme(maxWidth.lg)+theme(spacing.2))))] group-hover:opacity-100 group-focus:opacity-100 md:block lg:z-50 2xl:[--width:theme(spacing.10)]">
        <div className="group/anchor block h-5 w-5 rounded-lg bg-zinc-50 ring-1 ring-inset ring-zinc-300 transition hover:ring-zinc-500 dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:bg-zinc-700 dark:hover:ring-zinc-600">
          <AnchorIcon className="h-5 w-5 stroke-zinc-500 transition dark:stroke-zinc-400 dark:group-hover/anchor:stroke-white" />
        </div>
      </div> : null}
      {children}
    </Link>
  );
}

export function Heading<Level extends 2 | 3 | 4>({
  children,
  tag,
  label,
  level,
  anchor = true,
  ...props
}: React.ComponentPropsWithoutRef<`h${Level}`> & {
  id: string;
  tag?: string;
  label?: string;
  level?: Level;
  anchor?: boolean;
}): React.JSX.Element {
  const headingLevel = level ?? (2 as Level);
  let Component = "h2";
  if (headingLevel === 3) {
    Component = "h3";
  } else if (headingLevel === 4) {
    Component = "h4";
  }

  const ref = useRef<HTMLHeadingElement>(null);
  const registerHeading = useSectionStore((s) => s.registerHeading);

  const topMargin = remToPx(-3.5)
  const inView = useInView(ref, {
    margin: `${topMargin}px 0px 0px 0px`,
    amount: "all",
  });

  useEffect(() => {
    if (headingLevel === 2) {
      registerHeading({ id: props.id, ref, offsetRem: tag ?? label ? 8 : 6 });
    } else if (headingLevel === 3) {
      registerHeading({ id: props.id, ref, offsetRem: tag ?? label ? 7 : 5 });
    } else if (headingLevel === 4) {
      registerHeading({ id: props.id, ref, offsetRem: tag ?? label ? 6 : 4 });
    }
  }, [label, headingLevel, props.id, registerHeading, tag]);

  return (
    <>
      <Eyebrow tag={tag} label={label} />
      <Component ref={ref} className={tag ?? label ? "mt-2 scroll-mt-32" : "scroll-mt-24"} {...props}>
        {anchor ? (
          <Anchor id={props.id} inView={inView}>
            {children}
          </Anchor>
        ) : (
          children
        )}
      </Component>
    </>
  );
}
