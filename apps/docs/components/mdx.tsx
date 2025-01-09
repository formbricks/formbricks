import { Feedback } from "@/components/feedback";
import { Heading } from "@/components/heading";
import { Prose } from "@/components/prose";
import clsx from "clsx";
import Link from "next/link";

export const a = Link;
export { Button } from "@/components/button";
export { CodeGroup, Code as code, Pre as pre } from "@/components/code";

export const wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <article className="flex h-full flex-col pb-10 pt-16">
      <Prose className="flex-auto font-normal">{children}</Prose>
      <footer className="mx-auto mt-16 w-full max-w-2xl lg:max-w-5xl">
        <Feedback />
      </footer>
    </article>
  );
};

const createHeadingComponent = (
  level: 2 | 3 | 4
): React.FC<Omit<React.ComponentPropsWithoutRef<typeof Heading>, "level">> => {
  function Component(
    props: Omit<React.ComponentPropsWithoutRef<typeof Heading>, "level">
  ): React.JSX.Element {
    return <Heading level={level} {...props} />;
  }

  if (level === 2) {
    Component.displayName = "H2";
  } else if (level === 3) {
    Component.displayName = "H3";
  } else {
    Component.displayName = "H4";
  }

  return Component;
};

export const h2 = createHeadingComponent(2);
export const h3 = createHeadingComponent(3);
export const h4 = createHeadingComponent(4);

function InfoIcon(props: React.ComponentPropsWithoutRef<"svg">): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="8" strokeWidth="0" />
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.75 7.75h1.5v3.5"
      />
      <circle cx="8" cy="4" r=".5" fill="none" />
    </svg>
  );
}

export function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="my-6 flex gap-2.5 rounded-2xl border border-teal-500/20 bg-teal-50/50 p-4 leading-6 text-teal-900 dark:border-teal-500/30 dark:bg-teal-500/5 dark:text-teal-200 dark:[--tw-prose-links-hover:theme(colors.teal.300)] dark:[--tw-prose-links:theme(colors.white)]">
      <InfoIcon className="mt-1 h-4 w-4 flex-none fill-teal-500 stroke-white dark:fill-teal-200/20 dark:stroke-teal-200" />
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</div>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 items-start gap-x-16 gap-y-10 xl:max-w-none xl:grid-cols-2">
      {children}
    </div>
  );
}

export function Col({
  children,
  sticky = false,
}: {
  children: React.ReactNode;
  sticky?: boolean;
}): React.JSX.Element {
  return (
    <div className={clsx("[&>:first-child]:mt-0 [&>:last-child]:mb-0", sticky && "xl:sticky xl:top-24")}>
      {children}
    </div>
  );
}

export function Properties({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="my-6">
      <ul className="m-0 max-w-[calc(theme(maxWidth.lg)-theme(spacing.8))] list-none divide-y divide-zinc-900/5 p-0 dark:divide-white/5">
        {children}
      </ul>
    </div>
  );
}

export function Property({
  name,
  children,
  type,
}: {
  name: string;
  children: React.ReactNode;
  type?: string;
}): React.JSX.Element {
  return (
    <li className="m-0 px-0 py-4 first:pt-0 last:pb-0">
      <dl className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <dt className="sr-only">Name</dt>
        <dd>
          <code>{name}</code>
        </dd>
        {type ? (
          <>
            <dt className="sr-only">Type</dt>
            <dd className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{type}</dd>
          </>
        ) : null}
        <dt className="sr-only">Description</dt>
        <dd className="w-full flex-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</dd>
      </dl>
    </li>
  );
}
