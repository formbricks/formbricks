"use client";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { TSurvey, TSurveyReward } from "@formbricks/types/surveys/types";

interface RewardsViewProp {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  isCxMode: boolean;
}

export const RewardsView = ({ localSurvey, setLocalSurvey }: RewardsViewProp) => {
  const { t } = useTranslate();

  const form = useForm<TSurveyReward>({
    defaultValues: {
      enableReward: false,
    },
  });

  const enableReward = form.watch("enableReward");
  const setEnableReward = (value: boolean) => form.setValue("enableReward", value);

  const [_, setRewardOpen] = useState(false);

  useEffect(() => {
    if (!enableReward) {
      setRewardOpen(false);
    }
  }, [enableReward]);

  useEffect(() => {
    const subscription = form.watch((data: TSurveyReward) => {
      console.log(data, localSurvey);
      setLocalSurvey((prev) => ({
        ...prev,
        reward: {
          ...prev.reward,
          ...data,
        },
      }));
    });

    return () => subscription.unsubscribe();
  }, [form, setLocalSurvey, localSurvey]);

  const handleOverwriteToggle = (value: boolean) => {
    setEnableReward(value);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="mt-12 space-y-3 p-5">
          <div className="flex items-center gap-4 py-4">
            <FormField
              control={form.control}
              name="enableReward"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={handleOverwriteToggle} />
                  </FormControl>

                  <div>
                    <FormLabel className="text-base font-semibold text-slate-900">
                      {t("environments.surveys.edit.enable_survey_reward")}
                    </FormLabel>
                    <FormDescription className="text-sm text-slate-800">
                      {t("environments.surveys.edit.enable_survey_reward_description")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          {/* <FormStylingSettings
            open={formStylingOpen}
            setOpen={setFormStylingOpen}
            disabled={!overwriteThemeStyling}
            form={form as UseFormReturn<TProjectStyling | TSurveyStyling>}
          />

          <CardStylingSettings
            open={cardStylingOpen}
            setOpen={setCardStylingOpen}
            surveyType={localSurvey.type}
            disabled={!overwriteThemeStyling}
            project={project}
            form={form as UseFormReturn<TProjectStyling | TSurveyStyling>}
          />

          {localSurvey.type === "link" && (
            <BackgroundStylingCard
              open={stylingOpen}
              setOpen={setStylingOpen}
              environmentId={environmentId}
              colors={colors}
              disabled={!overwriteThemeStyling}
              isUnsplashConfigured={isUnsplashConfigured}
              form={form as UseFormReturn<TProjectStyling | TSurveyStyling>}
            />
          )}
            */}
        </div>
      </form>
    </FormProvider>
  );
};
