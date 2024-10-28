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
          {t("setup.intro.formbricks_is_an_experience_management_suite_built_of_the")}{" "}
          <b>{t("setup.intro.fastest_growing_open_source_survey_platform")}</b> {t("setup.intro.worldwide")}.
        </p>
        <p>
          {t("setup.intro.run_targeted_surveys_on_websites_in_apps_or_anywhere_online")}.{" "}
          {t("setup.intro.gather_valuable_insights_to")}{" "}
          <b>{t("setup.intro.craft_irresistible_experiences")}</b>{" "}
          {t("setup.intro.for_customers_users_and_employees")}
        </p>
        <p>
          {t("setup.intro.we_re_commited_to_highest_degree_of_data_privacy")}.{" "}
          {t("setup.intro.self_host_to_keep")} <b>{t("setup.intro.full_control_over_your_data")}</b>.{" "}
          {t("setup.intro.always")}
        </p>
      </div>
      <Button href="/setup/signup" className="mt-6">
        {t("setup.intro.get_started")}
      </Button>

      <p className="pt-6 text-xs text-slate-400">{t("setup.intro.made_with_love_in")} Kiel, Germany</p>
    </div>
  );
};

export default Page;
