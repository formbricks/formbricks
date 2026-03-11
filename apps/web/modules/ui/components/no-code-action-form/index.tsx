"use client";

import { InfoIcon } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { CssSelector } from "./components/css-selector";
import { InnerHtmlSelector } from "./components/inner-html-selector";
import { PageUrlSelector } from "./components/page-url-selector";

interface NoCodeActionFormProps {
  form: UseFormReturn<TActionClassInput>;
  isReadOnly: boolean;
}

export const NoCodeActionForm = ({ form, isReadOnly }: NoCodeActionFormProps) => {
  const { control, watch } = form;
  const { t } = useTranslation();
  return (
    <div data-testid="no-code-action-form">
      <FormField
        name={`noCodeConfig.type`}
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div>
                <Label>{t("environments.actions.what_is_the_user_doing")}</Label>
                <TabToggle
                  disabled={isReadOnly}
                  id="userAction"
                  {...field}
                  defaultSelected={field.value}
                  options={[
                    { value: "click", label: t("environments.actions.click") },
                    { value: "pageView", label: t("environments.actions.page_view") },
                    { value: "exitIntent", label: t("environments.actions.exit_intent") },
                    { value: "fiftyPercentScroll", label: t("environments.actions.fifty_percent_scroll") },
                    { value: "pageDwell", label: t("environments.actions.time_on_page") },
                  ]}
                />
              </div>
            </FormControl>
          </FormItem>
        )}
      />

      <div className="mt-2">
        {watch("noCodeConfig.type") === "click" && (
          <FormField
            control={control}
            name="noCodeConfig.elementSelector"
            render={() => (
              <FormItem>
                <FormControl>
                  <div>
                    <CssSelector form={form} disabled={isReadOnly} />
                    <InnerHtmlSelector form={form} disabled={isReadOnly} />
                  </div>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        )}
        {watch("noCodeConfig.type") === "pageView" && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>{t("environments.actions.page_view")}</AlertTitle>
            <AlertDescription>
              {t("environments.actions.this_action_will_be_triggered_when_the_page_is_loaded")}
            </AlertDescription>
          </Alert>
        )}
        {watch("noCodeConfig.type") === "exitIntent" && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>{t("environments.actions.exit_intent")}</AlertTitle>
            <AlertDescription>
              {t("environments.actions.this_action_will_be_triggered_when_the_user_tries_to_leave_the_page")}
            </AlertDescription>
          </Alert>
        )}
        {watch("noCodeConfig.type") === "fiftyPercentScroll" && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>{t("environments.actions.fifty_percent_scroll")}</AlertTitle>
            <AlertDescription>
              {t(
                "environments.actions.this_action_will_be_triggered_when_the_user_scrolls_50_percent_of_the_page"
              )}
            </AlertDescription>
          </Alert>
        )}
        {watch("noCodeConfig.type") === "pageDwell" && (
          <div className="flex flex-col gap-2">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>{t("environments.actions.time_on_page")}</AlertTitle>
              <AlertDescription>
                {t("environments.actions.this_action_will_be_triggered_after_user_stays_on_page")}
              </AlertDescription>
            </Alert>
            <FormField
              control={control}
              name="noCodeConfig.timeInSeconds"
              render={({ field }) => (
                <FormItem>
                  <Label>{t("environments.actions.time_in_seconds")}</Label>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      placeholder={t("environments.actions.time_in_seconds_placeholder")}
                      disabled={isReadOnly}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? undefined : Number(val));
                      }}
                    />
                  </FormControl>
                  <FormError />
                </FormItem>
              )}
            />
          </div>
        )}
        <PageUrlSelector form={form} isReadOnly={isReadOnly} />
      </div>
    </div>
  );
};
