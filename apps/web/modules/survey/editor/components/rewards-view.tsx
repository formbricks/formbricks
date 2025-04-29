"use client";

import NoTokensCTAButton from "@/modules/alchemy-wallet/components/common/no-tokens-cta-button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TSurvey, TSurveyReward } from "@formbricks/types/surveys/types";
import { useBlockscoutApi, useChainId } from "@formbricks/web3";

interface RewardsViewProp {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  isCxMode: boolean;
}

export const RewardsView = ({ localSurvey, setLocalSurvey }: RewardsViewProp) => {
  const { t } = useTranslate();
  const user = useUser();
  const chainId = useChainId();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<TokenBalance | null>(null);
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
    const fetchBalances = async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenBalances(address);
      setBalances(data.data);
    };

    fetchBalances();

    let interval = setInterval(fetchBalances, 60000);
    return () => clearInterval(interval);
  }, [blockscoutApi, address]);

  useEffect(() => {
    const subscription = form.watch((data: TSurveyReward) => {
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

  useEffect(() => {
    if (!selectedBalance) {
      return;
    }

    form.setValue("contractAddress", selectedBalance.token.address);
    form.setValue("decimals", Number(selectedBalance.token.decimals));
    form.setValue("name", selectedBalance.token.name);
    form.setValue("symbol", selectedBalance.token.symbol);
    form.setValue("chainId", Number(chainId));
  }, [selectedBalance]);

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
          {/* Update with collapsible component */}
          {balances &&
            enableReward &&
            (balances.length < 1 ? (
              <div className="flex w-full flex-col gap-4 rounded-lg">
                <FormLabel>
                  {t("common.no_tokens_click_the_button_below_to_mint_new_tokens_on_the_wonder_chain")}
                </FormLabel>
                <NoTokensCTAButton />
              </div>
            ) : (
              <>
                <div className="flex w-full flex-col gap-2 rounded-lg">
                  <FormLabel>{t("environments.wallet.form.token")}</FormLabel>
                  <Controller
                    name="contractAddress"
                    control={form.control}
                    rules={{
                      required: t("environments.wallet.form.error.address_required"),
                      pattern: {
                        value: /^0x[a-fA-F0-9]{40}$/,
                        message: t("environments.wallet.form.error.invalid_eth_address"),
                      },
                    }}
                    render={({ field }) => (
                      <Select
                        value={field.value ? field.value : undefined}
                        onValueChange={(address) => {
                          field.onChange(address);
                          const selected = balances.find((b) => b.token.address === address);
                          if (selected) setSelectedBalance(selected);
                        }}>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              selectedBalance
                                ? `${selectedBalance.token.symbol} — ${formatUnits(selectedBalance.value, parseInt(selectedBalance.token.decimals, 10))}`
                                : "Select a token address"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {balances?.map((balance) => (
                            <SelectItem
                              key={balance.token.address}
                              value={balance.token.address}
                              className="group font-normal hover:text-slate-900">
                              <div className="flex w-full items-center justify-start gap-2">
                                {balance.token.name} —{" "}
                                {formatUnits(balance.value, parseInt(balance.token.decimals, 10))}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex w-full flex-col gap-2 rounded-lg">
                  <FormLabel>{t("environments.wallet.form.reward_amount")}</FormLabel>
                  <Input
                    autoFocus
                    type="number"
                    placeholder={"0.00"}
                    step="any"
                    {...form.register("amount", {
                      required: t("environments.wallet.form.error.amount_required"),
                      min: {
                        value: 0.01,
                        message: t("environments.wallet.form.error.min_amount"),
                      },
                      max: {
                        value: selectedBalance
                          ? formatUnits(selectedBalance.value, parseInt(selectedBalance.token.decimals, 10))
                          : 0,
                        message: t("environments.wallet.form.error.max_amount"),
                      },
                      validate: (value) =>
                        (value && Number(value) > 0) || t("environments.wallet.form.error.positive_amount"),
                    })}
                  />
                </div>
              </>
            ))}

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
