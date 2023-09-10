"use client";

import { useInView } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { remToPx } from "@/lib/remToPx";
import { useSectionStore } from "./SectionProvider";
import { Tag } from "./Tag";
import { usePathname } from "next/navigation";

function AnchorIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg viewBox="0 0 20 20" fill="none" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="m6.5 11.5-.964-.964a3.535 3.535 0 1 1 5-5l.964.964m2 2 .964.964a3.536 3.536 0 0 1-5 5L8.5 13.5m0-5 3 3" />
    </svg>
  );
}

function Eyebrow({ tag, label }: { tag?: string; label?: string }) {
  if (!tag && !label) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-3">
      {tag && <Tag>{tag}</Tag>}
      {tag && label && <span className="h-0.5 w-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />}
      {label && <span className="font-mono text-xs text-slate-400">{label}</span>}
    </div>
  );
}

function Anchor({ id, inView, children }: { id: string; inView: boolean; children: React.ReactNode }) {
  return (
    <Link href={`#${id}`} className="group text-inherit no-underline hover:text-inherit">
      {inView && (
        <div className="absolute ml-[calc(-1*var(--width))] mt-1 hidden w-[var(--width)] opacity-0 transition [--width:calc(2.625rem+0.5px+50%-min(50%,calc(theme(maxWidth.lg)+theme(spacing.8))))] group-hover:opacity-100 group-focus:opacity-100 md:block lg:z-50 2xl:[--width:theme(spacing.10)]">
          <div className="group/anchor block h-5 w-5 rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-300 transition hover:ring-slate-500 dark:bg-slate-800 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:ring-slate-600">
            <AnchorIcon className="h-5 w-5 stroke-slate-500 transition dark:stroke-slate-400 dark:group-hover/anchor:stroke-white" />
          </div>
        </div>
      )}
      {children}
    </Link>
  );
}

export function HeadingDocs<Level extends 2 | 3>({
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
}) {
  level = level ?? (2 as Level);
  let Component = `h${level}` as "h2" | "h3";
  let ref = useRef<HTMLHeadingElement>(null);
  let registerHeading = useSectionStore((s) => s.registerHeading);

  let inView = useInView(ref, {
    margin: `${remToPx(-3.5)}px 0px 0px 0px`,
    amount: "all",
  });

  useEffect(() => {
    if (level === 2) {
      registerHeading({ id: props.id, ref, offsetRem: tag || label ? 8 : 6 });
    }
  });

  return (
    <>
      <Eyebrow tag={tag} label={label} />
      <Component ref={ref} className={tag || label ? "mt-2 scroll-mt-32" : "scroll-mt-24"} {...props}>
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

export function HeadingContent<Level extends 2 | 3>({
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
}) {
  level = level ?? (2 as Level);
  let Component = `h${level}` as "h2" | "h3";
  let ref = useRef<HTMLHeadingElement>(null);

  return (
    <>
      <Eyebrow tag={tag} label={label} />
      <Component ref={ref} className={tag || label ? "mt-2 scroll-mt-32" : "scroll-mt-24"} {...props}>
        {children}
      </Component>
    </>
  );
}

export function Heading(props: any) {
  const pathname = usePathname();
  if (pathname?.startsWith("/docs")) {
    return <HeadingDocs {...props} />;
  } else {
    return <HeadingContent {...props} />;
  }
}
