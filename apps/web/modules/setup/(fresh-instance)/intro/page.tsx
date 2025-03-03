import { Button } from "@/modules/ui/components/button";
import { getTranslate } from "@/tolgee/server";
import { T } from "@/tolgee/server";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

export const IntroPage = async () => {
  const t = await getTranslate();
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">{t("setup.intro.welcome_to_formbricks")}</h2>
      <div className="mx-auto max-w-sm space-y-4 text-sm leading-6 text-slate-600">
        <T keyName="setup.intro.paragraph_1" params={{ b: <b /> }} />
        <T keyName="setup.intro.paragraph_2" params={{ b: <b /> }} />
        <T keyName="setup.intro.paragraph_3" params={{ b: <b /> }} />
      </div>
      <Button className="mt-6" asChild>
        <Link href="/setup/signup">{t("setup.intro.get_started")}</Link>
      </Button>

      <p className="pt-6 text-xs text-slate-400">{t("setup.intro.made_with_love_in_kiel")}</p>
    </div>
  );
};
