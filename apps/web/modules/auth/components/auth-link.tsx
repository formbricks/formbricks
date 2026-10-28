import Link from "next/link";
import { cn } from "@/lib/cn";

export const authLinkClassName =
  "rounded-xs font-medium text-brandnew underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** An inline text link in the shell's one link style. */
export const AuthLink = ({ className, ...props }: Readonly<React.ComponentProps<typeof Link>>) => (
  <Link className={cn(authLinkClassName, className)} {...props} />
);
