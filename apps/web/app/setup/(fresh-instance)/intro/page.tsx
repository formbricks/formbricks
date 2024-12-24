import { Button } from "@/modules/ui/components/button";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

const renderRichText = async (text: string) => {
  const t = await getTranslations();
  return <p>{t.rich(text, { b: (chunks) => <b>{chunks}</b> })}</p>;
};

const Page = async () => {
  const t = await getTranslations();
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">{t("setup.intro.welcome_to_formbricks")}</h2>
      <div className="mx-auto max-w-sm space-y-4 text-sm leading-6 text-slate-600">
        {renderRichText("setup.intro.paragraph_1")}
        {renderRichText("setup.intro.paragraph_2")}
        {renderRichText("setup.intro.paragraph_3")}
      </div>
      <Button className="mt-6" asChild>
        <Link href="/setup/signup">{t("setup.intro.get_started")}</Link>
      </Button>

      <p className="pt-6 text-xs text-slate-400">{t("setup.intro.made_with_love_in_kiel")}</p>
    </div>
  );
};

export default Page;
