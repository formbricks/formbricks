"use client";

import { cn } from "@/lib/cn";
import { testURLmatch } from "@/lib/utils/url";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormField, FormItem } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { useTranslate } from "@tolgee/react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import {
  Control,
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
  useFieldArray,
} from "react-hook-form";
import toast from "react-hot-toast";
import { TActionClassInput, TActionClassPageUrlRule } from "@formbricks/types/action-classes";

interface PageUrlSelectorProps {
  form: UseFormReturn<TActionClassInput>;
  isReadOnly: boolean;
}

export const PageUrlSelector = ({ form, isReadOnly }: PageUrlSelectorProps) => {
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState("");
  const { t } = useTranslate();
  const filterType = form.watch("noCodeConfig.urlFilters")?.length ? "specific" : "all";

  const setFilterType = (value: string) => {
    form.setValue("noCodeConfig.urlFilters", value === "all" ? [] : [{ rule: "exactMatch", value: "" }]);
  };

  const handleMatchClick = () => {
    const match =
      form.watch("noCodeConfig.urlFilters")?.some((urlFilter) => {
        const res =
          testURLmatch(testUrl, urlFilter.value, urlFilter.rule as TActionClassPageUrlRule) === "yes";
        return res;
      }) || false;

    const isMatch = match ? "yes" : "no";

    setIsMatch(isMatch);
    if (isMatch === "yes") toast.success("Your survey would be shown on this URL.");
    if (isMatch === "no") toast.error("Your survey would not be shown.");
  };

  const {
    fields,
    append: appendUrlRule,
    remove: removeUrlRule,
  } = useFieldArray({
    control: form.control,
    name: "noCodeConfig.urlFilters",
  });

  const handleAddMore = () => {
    appendUrlRule({ rule: "exactMatch", value: "" });
  };

  return (
    <>
      <div className="mt-4 w-4/5">
        <FormField
          control={form.control}
          name="noCodeConfig.urlFilters"
          render={() => (
            <div>
              <Label className="font-semibold">{t("environments.actions.page_filter")}</Label>
              <p className="text-sm font-normal text-slate-500">
                {t("environments.actions.limit_the_pages_on_which_this_action_gets_captured")}
              </p>
              <TabToggle
                disabled={isReadOnly}
                id="filter"
                onChange={(value) => {
                  setFilterType(value);
                }}
                options={[
                  { value: "all", label: t("environments.actions.on_all_pages") },
                  { value: "specific", label: t("environments.actions.limit_to_specific_pages") },
                ]}
                defaultSelected={filterType}
              />
            </div>
          )}
        />
      </div>
      {filterType === "specific" && (
        <div className="mb-2 mt-4 w-full space-y-3 pe-2">
          <Label>{t("environments.actions.url")}</Label>
          <UrlInput
            control={form.control}
            fields={fields}
            removeUrlRule={removeUrlRule}
            disabled={isReadOnly}
          />
          <Button variant="secondary" size="sm" type="button" onClick={handleAddMore} disabled={isReadOnly}>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t("environments.actions.add_url")}
          </Button>
          <div className="mt-4">
            <div className="text-sm text-slate-900">{t("environments.actions.test_your_url")}</div>
            <div className="text-xs text-slate-400">
              {t("environments.actions.enter_a_url_to_see_if_a_user_visiting_it_would_be_tracked")}
            </div>
            <div className="rounded bg-slate-50">
              <div className="mt-1 flex items-end">
                <Input
                  type="text"
                  value={testUrl}
                  name="noCodeConfig.urlFilters.testUrl"
                  onChange={(e) => {
                    setTestUrl(e.target.value);
                    setIsMatch("default");
                  }}
                  className={cn(
                    isMatch === "yes"
                      ? "border-green-500 bg-green-50"
                      : isMatch === "no"
                        ? "border-red-200 bg-red-50"
                        : isMatch === "default"
                          ? "border-slate-200"
                          : "bg-white"
                  )}
                  placeholder="e.g. https://app.com/dashboard"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="ml-2 whitespace-nowrap"
                  onClick={() => {
                    handleMatchClick();
                  }}>
                  {t("environments.actions.test_match")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const UrlInput = ({
  control,
  fields,
  removeUrlRule,
  disabled,
}: {
  control: Control<TActionClassInput>;
  fields: FieldArrayWithId<TActionClassInput, "noCodeConfig.urlFilters", "id">[];
  removeUrlRule: UseFieldArrayRemove;
  disabled: boolean;
}) => {
  const { t } = useTranslate();
  return (
    <div className="flex w-full flex-col gap-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center space-x-2">
          {index !== 0 && <p className="ml-1 text-sm font-bold text-slate-700">or</p>}
          <FormField
            name={`noCodeConfig.urlFilters.${index}.rule`}
            control={control}
            render={({ field: { onChange, value, name } }) => (
              <FormItem>
                <FormControl>
                  <Select onValueChange={onChange} value={value} name={name} disabled={disabled}>
                    <SelectTrigger className="w-[250px] bg-white">
                      <SelectValue placeholder={t("environments.actions.select_match_type")} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="exactMatch">{t("environments.actions.exactly_matches")}</SelectItem>
                      <SelectItem value="contains">{t("environments.actions.contains")}</SelectItem>
                      <SelectItem value="startsWith">{t("environments.actions.starts_with")}</SelectItem>
                      <SelectItem value="endsWith">{t("environments.actions.ends_with")}</SelectItem>
                      <SelectItem value="notMatch">
                        {t("environments.actions.does_not_exactly_match")}
                      </SelectItem>
                      <SelectItem value="notContains">
                        {t("environments.actions.does_not_contain")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`noCodeConfig.urlFilters.${index}.value`}
            render={({ field, fieldState: { error } }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    type="text"
                    className="bg-white"
                    disabled={disabled}
                    {...field}
                    placeholder="e.g. https://app.com/dashboard"
                    autoComplete="off"
                    isInvalid={!!error?.message}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {fields.length > 1 && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                removeUrlRule(index);
              }}>
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};
