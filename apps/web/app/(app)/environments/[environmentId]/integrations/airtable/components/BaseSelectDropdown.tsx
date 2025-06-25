"use client";

import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { TIntegrationItem } from "@formbricks/types/integration";
import { IntegrationModalInputs } from "./AddIntegrationModal";

interface BaseSelectProps {
  control: Control<IntegrationModalInputs, any>;
  isLoading: boolean;
  fetchTable: (val: string) => Promise<void>;
  airtableArray: TIntegrationItem[];
  setValue: UseFormSetValue<IntegrationModalInputs>;
  defaultValue: string | undefined;
}

export const BaseSelectDropdown = ({
  airtableArray,
  control,
  fetchTable,
  isLoading,
  setValue,
  defaultValue,
}: BaseSelectProps) => {
  const { t } = useTranslate();
  return (
    <div className="flex w-full flex-col">
      <Label htmlFor="base">{t("environments.integrations.airtable.airtable_base")}</Label>
      <div className="mt-1 flex">
        <Controller
          control={control}
          name="base"
          render={({ field }) => (
            <Select
              required
              disabled={isLoading}
              onValueChange={async (val) => {
                field.onChange(val);
                await fetchTable(val);
                setValue("table", "");
              }}
              defaultValue={defaultValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {airtableArray.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
};
