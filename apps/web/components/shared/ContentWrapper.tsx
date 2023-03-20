import clsx from "clsx";

export default function ContentWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx("mx-auto max-w-7xl p-6", className)}>{children}</div>;
}
