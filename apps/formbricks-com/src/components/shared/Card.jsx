import Link from "next/link";
import clsx from "clsx";

function ChevronRightIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M6.75 5.75 9.25 8l-2.5 2.25" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Card({ as: Component = "div", className, children }) {
  return (
    <Component className={clsx(className, "group relative flex flex-col items-start")}>{children}</Component>
  );
}

Card.Link = function CardLink({ children, ...props }) {
  return (
    <>
      <div className="absolute -inset-y-6 -inset-x-4 scale-95 bg-slate-50 opacity-0 transition group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-800 sm:-inset-x-6 sm:rounded-2xl" />
      <Link {...props}>
        <span className="absolute -inset-y-6 -inset-x-4 sm:-inset-x-6 sm:rounded-2xl" />
        <span className="relative">{children}</span>
      </Link>
    </>
  );
};

Card.Title = function CardTitle({ as: Component = "h2", href, children }) {
  return (
    <Component className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
      {href ? <Card.Link href={href}>{children}</Card.Link> : children}
    </Component>
  );
};

Card.Description = function CardDescription({ children }) {
  return <p className="relative mt-2 text-sm text-slate-600 dark:text-slate-400">{children}</p>;
};

Card.Cta = function CardCta({ children }) {
  return (
    <div
      aria-hidden="true"
      className="relative mt-4 flex items-center text-sm font-medium text-brand-dark dark:text-brand-light">
      {children}
      <ChevronRightIcon className="ml-1 h-4 w-4 stroke-current" />
    </div>
  );
};

Card.Eyebrow = function CardEyebrow({
  as: Component = "p",
  decorate = false,
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={clsx(
        className,
        "relative order-first mb-3 flex items-center text-sm text-slate-400 dark:text-slate-500",
        decorate && "pl-3.5"
      )}
      {...props}>
      {decorate && (
        <span className="absolute inset-y-0 left-0 flex items-center" aria-hidden="true">
          <span className="h-4 w-0.5 rounded-full bg-slate-200 dark:bg-slate-500" />
        </span>
      )}
      {children}
    </Component>
  );
};
