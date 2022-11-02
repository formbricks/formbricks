import clsx from "clsx";

export function Prose({ as: Component = "div", className, ...props }) {
  return (
    <Component
      className={clsx(
        className,
        "prose prose-blue max-w-none dark:prose-invert dark:text-blue-400",
        // headings
        "prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem]",
        // lead
        "prose-lead:text-blue-500 dark:prose-lead:text-blue-400",
        // links
        "prose-a:font-semibold dark:prose-a:text-sky-400",
        // link underline
        "prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,theme(colors.sky.300))] hover:prose-a:[--tw-prose-underline-size:6px] dark:[--tw-prose-background:theme(colors.blue.900)] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,theme(colors.sky.800))] dark:hover:prose-a:[--tw-prose-underline-size:6px]",
        // pre
        "prose-pre:rounded-xl prose-pre:bg-blue-900 prose-pre:shadow-lg dark:prose-pre:bg-blue-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-blue-300/10",
        // hr
        "dark:prose-hr:border-blue-800"
      )}
      {...props}
    />
  );
}
