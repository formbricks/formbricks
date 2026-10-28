import { Metadata } from "next";
import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { AuthCard } from "@/modules/auth/components/form-wrapper";
import { Button } from "@/modules/ui/components/button";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

export const IntroPage = async () => {
  const t = await getTranslate();
  return (
    <AuthCard width="wide">
      <AuthHeading title={t("setup.intro.welcome_to_formbricks")} />
      <div className="flex flex-col gap-3 text-slate-600">
        <p dangerouslySetInnerHTML={{ __html: t("setup.intro.paragraph_1") }} />
        <p dangerouslySetInnerHTML={{ __html: t("setup.intro.paragraph_2") }} />
        <p dangerouslySetInnerHTML={{ __html: t("setup.intro.paragraph_3") }} />
      </div>
      <Button className="h-11 w-full sm:h-9" asChild>
        <Link href="/setup/signup">{t("setup.intro.get_started")}</Link>
      </Button>
    </AuthCard>
  );
};
