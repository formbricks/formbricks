import Link from "next/link";
import { cn } from "@/lib/cn";
import { getTranslate } from "@/lingodotdev/server";
import { Logo } from "@/modules/ui/components/logo";

/**
 * The page behind every signed-out screen: slate backdrop, the logo on top, the content centred and
 * 24px apart. Pages put an `<AuthCard>` inside it, and anything that belongs under the card (a
 * "Create an account" link, a footnote) after it.
 *
 * `min-h-dvh` rather than `min-h-screen`: `100vh` on mobile is the *large* viewport, which pushes a
 * vertically centred card under the browser chrome. Below 480px the card starts at the top instead of
 * floating in the middle, so the keyboard never covers the form.
 */
export const AuthPage = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const t = await getTranslate();

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-slate-50 px-4 py-10 max-[480px]:justify-start max-[480px]:py-8">
      <Link
        target="_blank"
        href="https://formbricks.com?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=auth_logo"
        rel="noopener noreferrer"
        aria-label={t("common.formbricks_homepage")}
        className="inline-block rounded-md focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-hidden">
        <Logo aria-hidden="true" className="w-40" />
      </Link>
      {children}
    </div>
  );
};

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

/**
 * The shell every server-rendered signed-out screen renders inside: page, card and an optional
 * footer. The routes outside the `(auth)/auth` layout (`/invite`, `/verify-email-change`,
 * `/email-change-without-verification-success`) use it too, so none of them hand-copies a shell.
 */
export const FormWrapper = ({
  children,
  footer,
  width,
}: Readonly<{ children: React.ReactNode; footer?: React.ReactNode; width?: "default" | "wide" }>) => (
  <AuthPage>
    <AuthCard width={width}>{children}</AuthCard>
    {footer ? <AuthFooter>{footer}</AuthFooter> : null}
  </AuthPage>
);
