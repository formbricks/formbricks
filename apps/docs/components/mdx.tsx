import { Feedback } from "@/components/Feedback";
import { Heading } from "@/components/Heading";
import { Prose } from "@/components/Prose";
import clsx from "clsx";
import Link from "next/link";

export const a = Link;
export { Button } from "@/components/Button";
export { CodeGroup, Code as code, Pre as pre } from "@/components/Code";

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

const createHeadingComponent = (level: 2 | 3 | 4) => {
  const Component = (props: Omit<React.ComponentPropsWithoutRef<typeof Heading>, "level">) => {
    return <Heading level={level} {...props} />;
  };

  Component.displayName = `H${level}`;
  return Component;
};

export const h2 = createHeadingComponent(2);
export const h3 = createHeadingComponent(3);
export const h4 = createHeadingComponent(4);

const InfoIcon = (props: React.ComponentPropsWithoutRef<"svg">) => {
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
};

export const Note = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="my-6 flex gap-2.5 rounded-2xl border border-teal-500/20 bg-teal-50/50 p-4 leading-6 text-teal-900 dark:border-teal-500/30 dark:bg-teal-500/5 dark:text-teal-200 dark:[--tw-prose-links-hover:theme(colors.teal.300)] dark:[--tw-prose-links:theme(colors.white)]">
      <InfoIcon className="mt-1 h-4 w-4 flex-none fill-teal-500 stroke-white dark:fill-teal-200/20 dark:stroke-teal-200" />
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</div>
    </div>
  );
};

export const Row = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="grid grid-cols-1 items-start gap-x-16 gap-y-10 xl:max-w-none xl:grid-cols-2">
      {children}
    </div>
  );
};

export const Col = ({ children, sticky = false }: { children: React.ReactNode; sticky?: boolean }) => {
  return (
    <div className={clsx("[&>:first-child]:mt-0 [&>:last-child]:mb-0", sticky && "xl:sticky xl:top-24")}>
      {children}
    </div>
  );
};

export const Properties = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="my-6">
      <ul
        role="list"
        className="m-0 max-w-[calc(theme(maxWidth.lg)-theme(spacing.8))] list-none divide-y divide-zinc-900/5 p-0 dark:divide-white/5">
        {children}
      </ul>
    </div>
  );
};

export const Property = ({
  name,
  children,
  type,
}: {
  name: string;
  children: React.ReactNode;
  type?: string;
}) => {
  return (
    <li className="m-0 px-0 py-4 first:pt-0 last:pb-0">
      <dl className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <dt className="sr-only">Name</dt>
        <dd>
          <code>{name}</code>
        </dd>
        {type && (
          <>
            <dt className="sr-only">Type</dt>
            <dd className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{type}</dd>
          </>
        )}
        <dt className="sr-only">Description</dt>
        <dd className="w-full flex-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</dd>
      </dl>
    </li>
  );
};
