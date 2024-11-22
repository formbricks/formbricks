"use client";

import ProlificLogo from "@/images/prolific-logo.webp";
import ProlificUI from "@/images/prolific-screenshot.webp";
import { Button } from "@/modules/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

interface PanelInfoViewProps {
  disableBack: boolean;
  handleInitialPageButton: () => void;
}

export const PanelInfoView = ({ disableBack, handleInitialPageButton }: PanelInfoViewProps) => {
  const t = useTranslations();
  return (
    <div className="h-full overflow-hidden text-slate-900">
      {!disableBack && (
        <div className="border-b border-slate-200 py-2">
          <Button
            variant="minimal"
            className="focus:ring-0"
            onClick={handleInitialPageButton}
            StartIcon={ArrowLeftIcon}>
            {t("common.back")}
          </Button>
        </div>
      )}
      <div className="grid h-full grid-cols-2">
        <div className="flex flex-col gap-y-6 border-r border-slate-200 p-8">
          <Image src={ProlificUI} alt="Prolific panel selection UI" className="rounded-lg shadow-lg" />
          <div>
            <p className="text-md font-semibold">{t("environments.surveys.summary.what_is_a_panel")}</p>
            <p className="text-slate-600">{t("environments.surveys.summary.what_is_a_pannel_answer")}</p>
          </div>
          <div>
            <p className="text-md font-semibold">{t("environments.surveys.summary.when_do_i_need_it")}</p>
            <p className="text-slate-600">{t("environments.surveys.summary.when_do_i_need_it_answer")}</p>
          </div>
          <div>
            <p className="text-md font-semibold">{t("environments.surveys.summary.what_is_prolific")}</p>
            <p className="text-slate-600">{t("environments.surveys.summary.what_is_prolific_answer")}</p>
          </div>
        </div>
        <div className="relative flex flex-col gap-y-6 bg-slate-50 p-8">
          <Image
            src={ProlificLogo}
            alt="Prolific panel selection UI"
            className="absolute right-8 top-8 w-32"
          />
          <div>
            <h3 className="text-xl font-semibold">
              {t("environments.surveys.summary.how_to_create_a_panel")}
            </h3>
          </div>
          <div>
            <p className="text-md font-semibold">
              {t("environments.surveys.summary.how_to_create_a_panel_step_1")}
            </p>
            <p className="text-slate-600">
              {t("environments.surveys.summary.how_to_create_a_panel_step_1_description")}
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">
              {t("environments.surveys.summary.how_to_create_a_panel_step_2")}
            </p>
            <p className="text-slate-600">
              {t("environments.surveys.summary.how_to_create_a_panel_step_2_description")}
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">
              {t("environments.surveys.summary.how_to_create_a_panel_step_3")}
            </p>
            <p className="text-slate-600">
              {t("environments.surveys.summary.how_to_create_a_panel_step_3_description")}
            </p>
          </div>
          <div>
            <p className="text-md font-semibold">
              {t("environments.surveys.summary.how_to_create_a_panel_step_4")}
            </p>
            <p className="text-slate-600">
              {t("environments.surveys.summary.how_to_create_a_panel_step_4_description")}
            </p>
          </div>
          <Button
            className="justify-center"
            href="https://formbricks.com/docs/link-surveys/market-research-panel"
            target="_blank">
            {t("common.get_started")}
          </Button>
        </div>
      </div>
    </div>
  );
};
