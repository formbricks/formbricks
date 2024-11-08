import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@formbricks/ui/components/Button";

export const metadata: Metadata = {
  title: "Intro",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  const t = await getTranslations();
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">{t("setup.intro.welcome_to_formbricks")}</h2>
      <div className="mx-auto max-w-sm space-y-4 text-sm leading-6 text-slate-600">
        <p>
          {t.rich("setup.intro.paragraph_1", {
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>
        <p>
          {t.rich("setup.intro.paragraph_2", {
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>
        <p>
          {t.rich("setup.intro.paragraph_3", {
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>
      </div>
      <Button size="base" href="/setup/signup" className="mt-6">
        {t("setup.intro.get_started")}
      </Button>

      <p className="pt-6 text-xs text-slate-400">{t("setup.intro.made_with_love_in_kiel")}</p>
    </div>
  );
};

export default Page;
