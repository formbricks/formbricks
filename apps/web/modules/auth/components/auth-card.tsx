import { cn } from "@/lib/cn";

/** The white card of an auth screen. 400px for the account forms, 480px (`wide`) for onboarding. */
export const AuthCard = ({
  width = "default",
  className,
  children,
}: Readonly<{ width?: "default" | "wide"; className?: string; children: React.ReactNode }>) => (
  <main
    className={cn(
      "flex w-full flex-col gap-5 rounded-xl border border-slate-200 bg-white p-7 shadow-xs max-[480px]:p-5",
      width === "wide" ? "max-w-120" : "max-w-100",
      className
    )}>
    {children}
  </main>
);

/** The line under the card: a question and the link that answers it. */
export const AuthFooter = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <p className="max-w-100 text-center text-slate-600">{children}</p>
);
