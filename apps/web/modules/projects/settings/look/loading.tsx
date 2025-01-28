"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import { cn } from "@formbricks/lib/cn";

const placements = [
  { name: "common.bottom_right", value: "bottomRight", disabled: false },
  { name: "common.top_right", value: "topRight", disabled: false },
  { name: "common.top_left", value: "topLeft", disabled: false },
  { name: "common.bottom_left", value: "bottomLeft", disabled: false },
  { name: "common.centered_modal", value: "center", disabled: false },
];

export const ProjectLookSettingsLoading = () => {
  const { t } = useTranslate();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation activeId="look" loading />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.look.theme")}
        className="max-w-7xl"
        description={t("environments.project.look.theme_settings_description")}>
        <div className="flex animate-pulse">
          <div className="w-1/2">
            <div className="flex flex-col gap-4 pr-6">
              <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-6">
                  <Switch />
                  <div className="flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {t("environments.project.look.enable_custom_styling")}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t("environments.project.look.enable_custom_styling_description")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 bg-slate-50 p-4">
                <div className="w-full rounded-lg border border-slate-300 bg-white">
                  <div className="flex flex-col p-4">
                    <h2 className="text-sm font-semibold text-slate-700">
                      {t("environments.surveys.edit.form_styling")}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields")}
                    </p>
                  </div>
                </div>

                <div className="w-full rounded-lg border border-slate-300 bg-white">
                  <div className="flex flex-col p-4">
                    <h2 className="text-sm font-semibold text-slate-700">
                      {t("environments.surveys.edit.card_styling")}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("environments.surveys.edit.style_the_survey_card")}
                    </p>
                  </div>
                </div>

                <div className="w-full rounded-lg border border-slate-300 bg-white">
                  <div className="flex flex-col p-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-700">
                        {t("environments.surveys.edit.background_styling")}
                      </h2>
                      <Badge type="gray" size="normal" text={t("common.link_surveys")} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("environments.surveys.edit.change_the_background_to_a_color_image_or_animation")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex w-1/2 flex-row items-center justify-center rounded-lg bg-slate-100 pt-4">
            <div className="relative mb-3 flex h-fit w-5/6 items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
              <div className="flex h-[90%] max-h-[90%] w-4/6 flex-1 flex-col">
                <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
                  <div className="ml-6 flex space-x-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                    <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                    <p>{t("common.preview")}</p>

                    <div className="flex items-center pr-6">{t("common.restart")}</div>
                  </div>
                </div>

                <div className="grid h-[500px] place-items-center bg-white">
                  <h1 className="text-xl font-semibold text-slate-700">{t("common.loading")}</h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Logo" description="Upload your company logo to brand surveys and link previews.">
        <div className="w-full animate-pulse items-center">
          <div className="relative flex h-52 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800">
            <p className="text-xl font-semibold text-slate-700">{t("common.loading")}</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="In-app Survey Placement"
        description="Change where surveys will be shown in your web app.">
        <div className="w-full items-center">
          <div className="flex cursor-not-allowed select-none">
            <RadioGroup>
              {placements.map((placement) => (
                <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
                  <RadioGroupItem
                    className="cursor-not-allowed select-none"
                    id={placement.value}
                    value={placement.value}
                    disabled={placement.disabled}
                  />
                  <Label
                    htmlFor={placement.value}
                    className={cn(
                      placement.disabled ? "cursor-not-allowed text-slate-500" : "text-slate-900"
                    )}>
                    {t(placement.name)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
              <div className={cn("absolute bottom-3 h-16 w-16 rounded bg-slate-700 sm:right-3")}></div>
            </div>
          </div>
          <Button className="pointer-events-none mt-4 animate-pulse cursor-not-allowed select-none bg-slate-200">
            {t("common.loading")}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Formbricks Signature"
        description="We love your support but understand if you toggle it off.">
        <div className="w-full items-center">
          <div className="pointer-events-none flex cursor-not-allowed select-none items-center space-x-2">
            <Switch id="signature" checked={false} />
            <Label htmlFor="signature">{t("environments.project.look.show_powered_by_formbricks")}</Label>
          </div>
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};
