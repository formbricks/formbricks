"use client";

import { cn } from "@/lib/cn";
import { testURLmatch } from "@/lib/utils/url";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
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
import { TFnType, useTranslate } from "@tolgee/react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Control,
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import toast from "react-hot-toast";
import {
  ACTION_CLASS_PAGE_URL_RULES,
  TActionClassInput,
  TActionClassPageUrlRule,
} from "@formbricks/types/action-classes";

const getRuleLabel = (rule: TActionClassPageUrlRule, t: TFnType): string => {
  switch (rule) {
    case "exactMatch":
      return t("environments.actions.exactly_matches");
    case "contains":
      return t("environments.actions.contains");
    case "startsWith":
      return t("environments.actions.starts_with");
    case "endsWith":
      return t("environments.actions.ends_with");
    case "notMatch":
      return t("environments.actions.does_not_exactly_match");
    case "notContains":
      return t("environments.actions.does_not_contain");
    case "matchesRegex":
      return t("environments.actions.matches_regex");
    default:
      return rule;
  }
};

interface PageUrlSelectorProps {
  form: UseFormReturn<TActionClassInput>;
  isReadOnly: boolean;
}

export const PageUrlSelector = ({ form, isReadOnly }: PageUrlSelectorProps) => {
  const [testUrl, setTestUrl] = useState("");
  const [isMatch, setIsMatch] = useState<boolean | null>(null);
  const { t } = useTranslate();
  const urlFilters = form.watch("noCodeConfig.urlFilters");
  const filterType = urlFilters?.length ? "specific" : "all";

  const setFilterType = (value: string) => {
    form.setValue("noCodeConfig.urlFilters", value === "all" ? [] : [{ rule: "exactMatch", value: "" }]);
  };

  const handleMatchClick = () => {
    try {
      const match =
        urlFilters?.some((urlFilter) => {
          return testURLmatch(testUrl, urlFilter.value, urlFilter.rule, t);
        }) || false;

      setIsMatch(match);
      if (match) toast.success(t("environments.actions.your_survey_would_be_shown_on_this_url"));
      if (!match) toast.error(t("environments.actions.your_survey_would_not_be_shown"));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const matchClass = useMemo(() => {
    if (isMatch === null) return "border-slate-200";
    return isMatch ? "border-green-500 bg-green-50" : "border-red-200 bg-red-50";
  }, [isMatch]);

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
            <Label className="font-semibold">{t("environments.actions.test_your_url")}</Label>
            <p className="text-sm font-normal text-slate-500">
              {t("environments.actions.enter_a_url_to_see_if_a_user_visiting_it_would_be_tracked")}
            </p>
            <div className="rounded">
              <div className="mt-1 flex items-end">
                <Input
                  type="text"
                  value={testUrl}
                  name="noCodeConfig.urlFilters.testUrl"
                  onChange={(e) => {
                    setTestUrl(e.target.value);
                    setIsMatch(null);
                  }}
                  className={cn(matchClass)}
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

  // Watch all rule values to determine placeholders
  const ruleValues = useWatch({
    control,
    name: "noCodeConfig.urlFilters",
  });
  return (
    <div className="flex w-full flex-col gap-2">
      {fields.map((field, index) => (
        <div key={field.id} className="ml-1 flex items-start space-x-2">
          {index !== 0 && <p className="ml-1 text-sm font-bold text-slate-700">or</p>}
          <FormField
            name={`noCodeConfig.urlFilters.${index}.rule`}
            control={control}
            render={({ field: { onChange, value, name } }) => (
              <FormItem>
                <FormControl>
                  <Select onValueChange={onChange} value={value} name={name} disabled={disabled}>
                    <SelectTrigger className="h-[40px] w-[250px] bg-white">
                      <SelectValue placeholder={t("environments.actions.select_match_type")} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {ACTION_CLASS_PAGE_URL_RULES.map((rule) => (
                        <SelectItem key={rule} value={rule}>
                          {getRuleLabel(rule, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`noCodeConfig.urlFilters.${index}.value`}
            render={({ field, fieldState: { error } }) => {
              const ruleValue = ruleValues[index]?.rule;

              return (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      type="text"
                      className="bg-white"
                      disabled={disabled}
                      {...field}
                      placeholder={
                        ruleValue === "matchesRegex"
                          ? t("environments.actions.add_regular_expression_here")
                          : t("environments.actions.enter_url")
                      }
                      autoComplete="off"
                      isInvalid={!!error?.message}
                    />
                  </FormControl>

                  <FormError />
                </FormItem>
              );
            }}
          />

          {fields.length > 1 && (
            <Button
              variant="secondary"
              size="tall"
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
